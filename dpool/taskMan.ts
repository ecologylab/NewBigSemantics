// Task manager.

/// <reference path="../typings/index.d.ts" />

import * as LRU from 'lru-cache';
import { Task, Log } from './types';
import { base32enc, sha256 } from '../utils/codec';
import logger from './logging';
import { taskLog } from './logging';

export default class TaskMan {

  private static defaultCacheSize = 10000;

  private static defaultUserAgent = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36';

  private static defaultMaxAttempts = 3;

  private static defaultMsPerAttempt = 15000;

  private done: LRU.Cache<Task>;

  private tasks: Array<Task>;

  constructor() {
    this.done = LRU<Task>({
      max: TaskMan.defaultCacheSize,
    });
    this.tasks = new Array<Task>();
  }

  newTask(task: any, callback: (error: Error, result: any)=>void): void {
    var t: Task = {
      id: base32enc(sha256(Date.now() + '|' + task.url)).substr(0, 10),
      url: task.url,
      userAgent: task.userAgent || TaskMan.defaultUserAgent,
      maxAttempts: task.maxAttempts || TaskMan.defaultMaxAttempts,
      msPerAttempt: task.msPerAttempt || TaskMan.defaultMsPerAttempt,
    };
    t.state = 'ready';
    t.callback = callback;
    this.tasks.push(t);
    taskLog(t, 'queued');
    logger.info({ url: t.url, id: t.id, }, 'task queued');
  }

  redispatch(task: Task): void {
    task.state = 'ready';
    this.tasks.unshift(task);
    taskLog(task, 'requeued');
    logger.info({ url: task.url, id: task.id }, 'task requeued');
  }

  // goes through all tasks in order, until a dispatchable task is found.
  //
  // finished / terminated tasks will be moved to this.done.
  //
  // tasks that are already dispatched, or not dispatchable right now will be
  // skipped.
  //
  // - callback: test if a task is dispatchable and actually dispatch it.
  //
  // returns true if such a task was found and dispatched.
  findAndDispatch(callback: (task: Task)=>boolean): boolean {
    var buf = new Array<Task>();

    var found = false;

    while (this.tasks.length > 0) {
      var task = this.tasks.shift();

      if (task.state === 'finished' || task.state === 'terminated') {
        this.done.set('[' + task.id + ']' + task.url, task);
      } else if (task.state === 'dispatched') {
        buf.push(task);
      } else {
        // task.state === 'ready'
        if (callback(task)) {
          found = true;
          break;
        } else {
          buf.push(task);
        }
      }
    }

    while (buf.length > 0) {
      var t = buf.pop();
      this.tasks.unshift(t);
    }

    return found;
  }

}
