// Worker manager.

import * as fs from 'fs';
import * as path from 'path';
import { Task, Worker } from './types';
import { seq, shuffle } from '../utils/math';
import { spawn } from '../utils/process';
import logger from './logging';
import { nicePResult } from './logging';
import { createConnection } from './socksConnection';

export default class WorkerMan {

  private static defaultHeartbeatTimeout = 1000 * 7.5;

  private static defaultHeartbeatInterval = 1000;

  private static defaultHeartbeatCycle = 1000 * 50;

  private workers: Worker[];

  private heartbeatIID;

  constructor(private options: any = {}) {
    options.heartbeatTimeout = options.heartbeatTimeout || WorkerMan.defaultHeartbeatTimeout;
    options.heartbeatInterval = options.heartbeatInterval || WorkerMan.defaultHeartbeatInterval;
    options.heartbeatCycle = options.heartbeatCycle || WorkerMan.defaultHeartbeatCycle;
    options.startPort = options.startPort || 8080;

    this.workers = [];

    var pdir = path.normalize(__dirname);
    // this.workerScript = path.join(pdir, 'script', 'all');
    // this.heartbeatScript = path.join(pdir, 'script', 'heartbeat');
    // logger.info({ path: this.workerScript, }, "worker script found");
    // logger.info({ path: this.heartbeatScript, }, "heartbeat script found");
  }

  newWorker(worker: any): void {
    var w: Worker = {
      id: worker.host + ':' + worker.port,
      host: worker.host,
      port: worker.port,
      user: worker.user,
      identity: worker.identity,
      state: 'unresponsive',
      socksPort: this.options.startPort + this.workers.length,

      stats: {
        successfulDownloads: 0,
        failedDownloads: 0,
        downloadTime: 0,
        downloadBytes: 0,

        successfulConnections: 0,
        failedConnections: 0,
        connectionAttempts: 0
      }
    };

    // remove 'unserializable' attributes
    w["toJSON"] = function() {
      return {
        id: w.id,
        host: w.host,
        port: w.port,
        socksPort: w.socksPort,
        user: w.user,
        state: w.state,
        stats: w.stats
      };

      // return JSON.stringify(w, ["id", "host", "port", "user", "state", "socksPort"]);
    };

    this.workers.push(w);
    logger.info({ id: w.id, }, "worker added");
  }

  // goes through all workers in random order, until a dispatchable worker is
  // found.
  //
  // workers that are busy, faulty, or unresponsive will be skipped.
  //
  // - callback: test if a worker is dispatchable and actually dispatch it.
  //
  // returns true if such a worker was found and dispatched.
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

  handle(task: Task, worker: Worker, callback: (error: Error, presult: any) => void): void {
    var presult: any = {};

    logger.info({
      url: task.url,
      taskId: task.id,
      workerId: worker.id,
      args: args,
    }, "handling task");

    var args = [
      "--socks5-hostname",
      "localhost:" + worker.socksPort,
      "-A",
      task.userAgent,
      "-ksiL",
      task.url
    ];

    let timedOut = false;

    let start = Date.now();

    let timeout = setTimeout(() => {
      timedOut = true;
      // your lack of cooperation will be noted...
      worker.stats.failedDownloads += 1;

      callback(new Error("Request timed out!"), null);
    }, 15000);

    spawn("curl", args, null, (err, res) => {
      if(timedOut) {
        return;
      }

      clearTimeout(timeout);
      
      worker.stats.successfulDownloads += 1;
      let timeSpent = Date.now() - start;
      worker.stats.downloadTime += timeSpent;

      if (res) {
        presult.code = res.code;

        if (res.stdout === null) {
          callback(new Error("stdout is null!"), null);
          return;
        }

        presult.stdout = new Buffer(res.stdout);
        worker.stats.downloadBytes += presult.stdout.length;

        if(res.stderr)
          presult.stderr = new Buffer(res.stderr);
      }

      callback(err, presult);
    });
  }

  private attemptConnection(worker: Worker) {
    createConnection(worker.host, worker.user, worker.socksPort).then(conn => {
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
      let timeout = Math.pow(attempts + 1, 2) * 60 * 1000;
      // maximum 12 hour timeout
      timeout = Math.min(timeout, 12 * 3600 * 1000);
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
    // var tryWorker = worker => {
    //   var args = [
    //     // this.heartbeatScript,
    //     worker.host,
    //     String(worker.port),
    //     worker.user,
    //     worker.identity,
    //     String(this.options.heartbeatTimeout / 1000),
    //   ];

    //   spawn('bash', args, null, (err, res) => {
    //     if (err) {
    //       if (worker.state === 'ready') {
    //         logger.warn({
    //           workerId: worker.id,
    //           err: err,
    //           heartbeatResult: nicePResult(res),
    //         }, "worker unresponsive");
    //       }
    //       worker.state = 'unresponsive';
    //     } else {
    //       if (worker.state === 'unresponsive') {
    //         worker.state = 'ready';
    //         logger.info({ workerId: worker.id, }, "worker ready");
    //       }
    //     }
    //   });
    // };

    // var tryAll = () => {
    //   var k = this.workers.length * this.options.heartbeatInterval / this.options.heartbeatCycle;
    //   var m = Math.floor(k), n = Math.ceil(k);
    //   var w = m;
    //   if (n > m && Math.random() < k-m) { w = n; }

    //   var indexes = shuffle(seq(this.workers.length)).slice(0, w);
    //   for (var i = 0; i < indexes.length; ++i) {
    //     var j = indexes[i];
    //     tryWorker(this.workers[j]);
    //   }
    // };

    // this.heartbeatIID = setInterval(tryAll, this.options.heartbeatInterval);
  }

  stop(): void {
    // if (this.heartbeatIID) {
    //   clearInterval(this.heartbeatIID);
    //   this.heartbeatIID = null;
    // }

    for (let worker of this.workers) {
      worker.connection.close();
    }
  }
}
