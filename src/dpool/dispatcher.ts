// Dispatcher.

import * as events from 'events';
import * as logging from '../utils/logging';
import * as config from '../utils/config';
import { DPoolOptions } from './options';
import { ExitError, SpawnResult, niceSpawnResult } from '../utils/process';
import logger from './logging';
import Matcher from './matcher';
import TaskMan from './taskMan';
import WorkerMan from './workerMan';
import parseHttpResp from './httpRespParser';

let dpoolOptions = config.getOrFail('dpool', logger) as DPoolOptions;

/**
 *
 */
export default class Dispatcher extends events.EventEmitter {

  private dispatchIID: any;
  private taskMan: TaskMan;
  private workerMan: WorkerMan;
  private matcher: Matcher;

  constructor(taskMan: TaskMan, workerMan: WorkerMan, matcher: Matcher) {
    super();
    this.taskMan = taskMan;
    this.workerMan = workerMan;
    this.matcher = matcher;
  }

  dispatchNext(): boolean {
    return this.taskMan.findAndDispatch(task => {
      return this.workerMan.findAndDispatch(worker => {
        if (this.matcher.matches(worker, task)) {
          // worker can handle task, dispatch it
          task.state = 'dispatched';
          worker.state = 'busy';
          task.log('dispatching', { worker: worker });
          logger.info({
            url: task.url,
            taskId: task.id,
            workerId: worker.id,
          }, "dispatching");

          this.workerMan.handle(task, worker).then(spawnResult => {
            worker.state = 'ready';

            // // hack for binary files
            // let strStdout: string = spawnResult.stdout.toString();
            // let end = strStdout.indexOf("\r\n\r\n") + 4;
            //
            // let resp = parseHttpResp(task.url, new Buffer(strStdout));
            // if (resp) {
            //   if (spawnResult.stdout instanceof Buffer) {
            //     resp.raw = spawnResult.stdout.slice(end);
            //   } else {
            //     resp.raw = new Buffer(spawnResult.stdout.slice(end));
            //   }
            // }

            let resp = parseHttpResp(task.url, spawnResult.stdout as Buffer);

            task.state = 'finished';
            task.logs.push({
              datetime: new Date(),
              name: 'finished',
            });
            logger.info({ url: task.url, id: task.id, }, "task successfully finished");

            task.response = resp;
            task.emit('finish');
          }).catch(err => {
            worker.state = 'ready';

            let processResult: SpawnResult = null;
            if (err instanceof ExitError) {
              processResult = niceSpawnResult(err.result);
            }
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
            task.emit('error', err);

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
              task.emit('terminated');
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
    }, dpoolOptions.dispatching_interval);
  }

  stop(): void {
    if (this.dispatchIID) {
      clearInterval(this.dispatchIID);
      this.dispatchIID = null;
    }
  }

}
