// Worker manager.

/// <reference path="../typings/index.d.ts" />

import * as fs from 'fs';
import * as path from 'path';
import { Task, Worker } from './types';
import { seq, shuffle } from '../utils/math';
import { spawn } from '../utils/process';
import logger from './logging';
import { nicePResult } from './logging';

export default class WorkerMan {

  private static defaultHeartbeatTimeout = 1000 * 7.5;

  private static defaultHeartbeatInterval = 1000;

  private static defaultHeartbeatCycle = 1000 * 50;

  private workers: Array<Worker>;

  private workerScript: string;

  private heartbeatScript: string;

  private heartbeatIID;

  constructor(private options: any = {}) {
    options.heartbeatTimeout = options.heartbeatTimeout || WorkerMan.defaultHeartbeatTimeout;
    options.heartbeatInterval = options.heartbeatInterval || WorkerMan.defaultHeartbeatInterval;
    options.heartbeatCycle = options.heartbeatCycle || WorkerMan.defaultHeartbeatCycle;
    this.options = options;

    this.workers = new Array<Worker>();

    var pdir = path.dirname(__dirname);
    this.workerScript = path.join(pdir, 'script', 'all');
    this.heartbeatScript = path.join(pdir, 'script', 'heartbeat');
    logger.info({ path: this.workerScript, }, "worker script found");
    logger.info({ path: this.heartbeatScript, }, "heartbeat script found");
  }

  newWorker(worker: any): void {
    var w: Worker = {
      id: worker.host + ':' + worker.port,
      host: worker.host,
      port: worker.port,
      user: worker.user,
      identity: worker.identity,
      state: 'unresponsive',
    }
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
  findAndDispatch(callback: (worker: Worker)=>boolean): boolean {
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

  handle(task: Task, worker: Worker, callback: (error: Error, presult: any)=>void): void {
    var presult: any = {};

    var args = [
      this.workerScript,
      worker.host,
      String(worker.port),
      worker.user,
      worker.identity,
      task.userAgent,
      task.url,
      String(task.msPerAttempt / 1000),
    ];

    logger.info({
      url: task.url,
      taskId: task.id,
      workerId: worker.id,
      args: args,
    }, "handling task");
    spawn('bash', args, null, (err, res) => {
      if (res) {
        presult.code = res.code;
        presult.stdout = res.stdout;
        presult.stderr = res.stderr;
      }
      callback(err, presult);
    });
  }

  start(): void {
    var tryWorker = worker => {
      var args = [
        this.heartbeatScript,
        worker.host,
        String(worker.port),
        worker.user,
        worker.identity,
        String(this.options.heartbeatTimeout / 1000),
      ];

      spawn('bash', args, null, (err, res) => {
        if (err) {
          if (worker.state === 'ready') {
            logger.warn({
              workerId: worker.id,
              err: err,
              heartbeatResult: nicePResult(res),
            }, "worker unresponsive");
          }
          worker.state = 'unresponsive';
        } else {
          if (worker.state === 'unresponsive') {
            worker.state = 'ready';
            logger.info({ workerId: worker.id, }, "worker ready");
          }
        }
      });
    };

    var tryAll = () => {
      var k = this.workers.length * this.options.heartbeatInterval / this.options.heartbeatCycle;
      var m = Math.floor(k), n = Math.ceil(k);
      var w = m;
      if (n > m && Math.random() < k-m) { w = n; }

      var indexes = shuffle(seq(this.workers.length)).slice(0, w);
      for (var i = 0; i < indexes.length; ++i) {
        var j = indexes[i];
        tryWorker(this.workers[j]);
      }
    };

    this.heartbeatIID = setInterval(tryAll, this.options.heartbeatInterval);
  }

  stop(): void {
    if (this.heartbeatIID) {
      clearInterval(this.heartbeatIID);
      this.heartbeatIID = null;
    }
  }

}
