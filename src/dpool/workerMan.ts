// Worker manager.

import * as Promise from 'bluebird';
import { seq, shuffle } from '../utils/math';
import { spawn, ExitError, SpawnResult, niceSpawnResult } from '../utils/process';
import logger from './logging';
import { SOCKSConnection, createConnection } from './socksConnection';
import { Task } from './taskMan';

/**
 *
 */
interface WorkerStats {
  successfulDownloads?: number;
  failedDownloads?: number;

  downloadTime?: number; // unit: millisecond
  downloadBytes?: number;

  successfulConnections?: number;
  failedConnections?: number;
  connectionAttempts?: number;
}

/**
 *
 */
export interface WorkerProto {
  host: string;
  port: number;
  user: string;
  identity?: string;
}

/**
 *
 */
export class Worker implements WorkerProto {
  id: string;

  host: string;
  port: number;
  user: string;
  identity: string;

  state: 'ready' | 'busy' | 'faulty' | 'unresponsive';
  nextAccess: { [domain: string]: Date };

  stats: WorkerStats;

  socksPort: number;
  connection: SOCKSConnection;

  constructor(proto: WorkerProto) {
    this.id = proto.host + ':' + proto.port;
    this.host = proto.host;
    this.port = proto.port;
    this.user = proto.user;
    this.identity = proto.identity;
    this.state = 'unresponsive';
    this.nextAccess = {};
    this.stats = {
      successfulDownloads: 0,
      failedDownloads: 0,
      downloadTime: 0,
      downloadBytes: 0,
      successfulConnections: 0,
      failedConnections: 0,
      connectionAttempts: 0
    };
  }

  /**
   * Remove 'unserializable' fields.
   */
  toJSON() {
    return {
      id: this.id,
      host: this.host,
      port: this.port,
      socksPort: this.socksPort,
      user: this.user,
      state: this.state,
      stats: this.stats,
    };
  }
}

/**
 * @param {Buffer|string} d
 * @return {Buffer}
 */
function toBuffer(d: Buffer | string): Buffer {
  if (d instanceof Buffer) return d;
  return new Buffer(d);
}

/**
 *
 */
export interface WorkerManOptions {
  workerStartPort: number;
  workerTaskTimeout: number;
  workerConnectionTimeout: number;
  workerMaxConnectionTimeout: number;
}

/**
 *
 */
export class WorkerMan {

  private options: WorkerManOptions;
  private workers: Worker[] = [];

  constructor(options: WorkerManOptions) {
    this.options = options;
  }

  getWorkers(): Worker[] {
    return this.workers;
  }

  newWorker(proto: WorkerProto): Worker {
    var worker = new Worker(proto);
    worker.socksPort = this.options.workerStartPort + this.workers.length;
    this.workers.push(worker);
    logger.info({ id: worker.id, }, "worker added");
    return worker;
  }

  /**
   * Goes through all workers in random order, until a dispatchable worker is
   * found. Workers that are busy, faulty, or unresponsive will be skipped.
   *
   * @param {Worker=>boolean} callback
   *   A function which takes a worker in, returns true iff the worker is
   *   dispatchable, and at the same time dispatches the worker when it is
   *   dispatchable.
   *
   * @return {boolean} True iff a dispatchable worker was found and dispatched.
   */
  findAndDispatch(callback: (worker: Worker) => boolean): boolean {
    var indexes = shuffle(seq(this.workers.length));
    for (var i = 0; i < this.workers.length; ++i) {
      var j = indexes[i];
      var worker = this.workers[j];
      if (worker.state === 'ready') {
        if (callback(worker)) {
          return true;
        }
      }
    }
    return false;
  }

  handle(task: Task, worker: Worker): Promise<SpawnResult> {
    let args = [
      "--socks5-hostname",
      "localhost:" + worker.socksPort,
      "-A",
      task.userAgent,
      "-ksiL",
      task.url
    ];
    if (worker.identity) {
      args.unshift(worker.identity);
      args.unshift("-i");
    }

    logger.info({
      url: task.url,
      taskId: task.id,
      workerId: worker.id,
      args: args,
    }, "handling task");

    let start = Date.now();

    return spawn("curl", args)
      .timeout(this.options.workerTaskTimeout, "Request timed out!")
      .then(spawnResult => {
        worker.stats.successfulDownloads += 1;
        let timeSpent = Date.now() - start;
        worker.stats.downloadTime += timeSpent;

        if (!spawnResult.stdout) {
          throw new ExitError(spawnResult, "Stdout is null!");
        }

        spawnResult.stdout = toBuffer(spawnResult.stdout);
        if (spawnResult.stderr)
          spawnResult.stderr = toBuffer(spawnResult.stderr);

        worker.stats.downloadBytes += spawnResult.stdout.length;

        return spawnResult;
      })
      .catch(err => {
        // your lack of cooperation will be noted...
        worker.stats.failedDownloads += 1;

        throw err; // for chained catch()
      });
  }

  private attemptConnection(worker: Worker) {
    createConnection(worker.host, worker.user, worker.socksPort, worker.identity)
      .then(conn => {
        worker.connection = conn;
        worker.state = "ready";

        // reset connectionAttempts (therefore resetting the exponential timeout)
        worker.stats.connectionAttempts = 0;
        worker.stats.successfulConnections += 1;

        conn.onError(() => {
          worker.state = "unresponsive";

          logger.info({
            worker: worker
          }, "Connection interrupted");

          this.attemptConnection(worker);
        });
      })
      .catch(err => {
        // keep track of attempts so we can grow timeout
        worker.stats.failedConnections += 1;

        let attempts = worker.stats.connectionAttempts++;

        // grow timeout exponentially based on number of connection attempts
        let timeout = Math.pow(attempts + 1, 2) * this.options.workerConnectionTimeout;
        // maximum 12 hour timeout
        timeout = Math.min(timeout, this.options.workerMaxConnectionTimeout);
        // attempt again after timeout
        setTimeout(() => this.attemptConnection(worker), timeout);

        logger.error({
          worker: worker,
          err: err,
          timeout: timeout / 1000
        }, "Failed to connect");
      });
  }

  start(): void {
    for (let worker of this.workers) {
      this.attemptConnection(worker);
    }
  }

  stop(): void {
    for (let worker of this.workers) {
      worker.connection.close();
    }
  }
}

export default WorkerMan;
