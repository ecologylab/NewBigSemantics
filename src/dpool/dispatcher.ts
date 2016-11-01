// Dispatcher.

/// <reference path="../../typings/index.d.ts" />

import * as events from 'events';
import Matcher from './matcher';
import TaskMan from './taskMan';
import WorkerMan from './workerMan';
import parseHttpResp from './httpRespParser';
import { Task, Worker } from './types';
import logger from './logging';
import { taskLog, nicePResult } from './logging';

export default class Dispatcher extends events.EventEmitter {

  private static defaultDispatchingInterval = 1000;

  private dispatchIID: any;

  constructor(private taskMan: TaskMan,
              private workerMan: WorkerMan,
              private matcher: Matcher,
              private options?: any) {
    super();
    this.options = options || {
      dispatchingInterval: Dispatcher.defaultDispatchingInterval,
    };
  }

  dispatchNext(): boolean {
    return this.taskMan.findAndDispatch(task => {
      return this.workerMan.findAndDispatch(worker => {
        if (this.matcher.matches(worker, task)) {
          // worker can handle task, dispatch it
          task.state = 'dispatched';
          worker.state = 'busy';
          taskLog(task, 'dispatching', { worker: worker });
          logger.info({
            url: task.url,
            taskId: task.id,
            workerId: worker.id,
          }, "dispatching");

          this.workerMan.handle(task, worker, (err, presult) => {
            worker.state = 'ready';
            if (err) {
              var processResult = nicePResult(presult);
              task.logs.push({
                datetime: new Date(),
                name: 'error on handling',
                args: {
                  worker: worker,
                  error: err.message,
                  processResult: processResult,
                },
              });
              logger.warn({
                err: err,
                processResult: processResult,
                url: task.url,
                taskId: task.id,
                workerId: worker.id,
              }, "error when handling task on worker");

              task.attempts = (task.attempts || 0) + 1;
              if (task.attempts < task.maxAttempts) {
                task.state = 'ready';
                this.taskMan.redispatch(task);
                this.emit('task_redispatching', err, task)
              } else {
                task.state = 'terminated';
                task.logs.push({
                  datetime: new Date(),
                  name: 'terminated',
                });
                logger.warn({ url: task.url, id: task.id, }, "task terminated");

                if (typeof task.callback === 'function') {
                  task.callback(new Error("Too many errors."), task);
                }
              }
            } else {
              task.state = 'finished';
                task.logs.push({
                  datetime: new Date(),
                  name: 'finished',
                });
              logger.info({ url: task.url, id: task.id, }, "task successfully finished");

              // hack for binary files
              let strStdout: string = presult.stdout.toString();
              let end = strStdout.indexOf("\r\n\r\n") + 4;

              parseHttpResp(task.url, new Buffer(strStdout), (err, resp) => {
                if(resp) {
                  resp.raw = presult.stdout.slice(end);
                }

                task.response = resp;
                if (typeof task.callback === 'function') {
                  if (err) {
                    return task.callback(err, task);
                  }
                  task.callback(null, task);
                }
              });
            }
          });

          // if task is dispatched, stop looking for next worker.
          // returning true will short circuit randSome().
          return true;
        }
        return false;
      });
    });
  }

  start(): void {
    this.dispatchIID = setInterval(() => {
      while (this.dispatchNext()) {
        // no op
      };
    }, this.options.dispatchingInterval);
  }

  stop(): void {
    if (this.dispatchIID) {
      clearInterval(this.dispatchIID);
      this.dispatchIID = null;
    }
  }

}
