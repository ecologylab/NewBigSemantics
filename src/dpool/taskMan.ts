// Task manager.

import * as events from 'events';
import * as LRU from 'lru-cache';
import { base32enc, sha256 } from '../utils/codec';
import * as logging from '../utils/logging';
import logger from './logging';
import { HttpResponse } from './httpRespParser';

/**
 *
 */
export interface TaskProto {
  url: string;
  userAgent?: string;
  maxAttempts?: number;
  timePerAttempt?: number;
}

/**
 * A DPool task.
 */
export class Task extends logging.Task implements TaskProto {
  id: string;

  url: string;
  userAgent: string;
  timePerAttempt: number;
  maxAttempts: number;

  /**
   * states:
   * - ready: ready to be dispatched to a worker.
   * - dispatched: dispatched to a worker; ongoing.
   * - finished: successfully done, and reported.
   * - terminated: unsuccessfully stopped after attempt(s), and reported.
   */
  state: 'ready' | 'dispatched' | 'finished' | 'terminated';
  attempts: number;
  response: HttpResponse;

  constructor(proto: TaskProto) {
    super();
    this.url = proto.url;
    this.id = base32enc(sha256(Date.now() + '|' + proto.url)).substr(0, 10);

    this.userAgent = proto.userAgent;
    this.maxAttempts = proto.maxAttempts;
    this.timePerAttempt = proto.timePerAttempt;

    this.state = 'ready';
  }
}

/**
 *
 */
export interface TaskManOptions {
  cacheSize: number;

  defaultUserAgent: string;
  defaultMaxAttempts: number;
  defaultTimePerAttempt: number;
}

/**
 * Task manager.
 */
export class TaskMan {

  private options: TaskManOptions;
  private done: LRU.Cache<Task>;
  private tasks: Task[];

  constructor(options: TaskManOptions) {
    this.options = options;
    this.done = LRU<Task>({
      max: this.options.cacheSize,
    });
    this.tasks = [];
  }

  newTask(proto: TaskProto): Task {
    if (!proto.userAgent) {
      proto.userAgent = this.options.defaultUserAgent;
    }
    if (!proto.maxAttempts) {
      proto.maxAttempts = this.options.defaultMaxAttempts;
    }
    if (!proto.timePerAttempt) {
      proto.timePerAttempt = this.options.defaultTimePerAttempt;
    }

    var task: Task = new Task(proto);
    this.tasks.push(task);
    task.log('queued');
    logger.info({ url: task.url, id: task.id, }, 'task queued');
    return task;
  }

  redispatch(task: Task): void {
    task.state = 'ready';
    this.tasks.unshift(task);
    task.log('requeued');
    logger.info({ url: task.url, id: task.id }, 'task requeued');
  }

  /**
   * Goes through all tasks in order, until a dispatchable task is found.
   * Finished / terminated tasks will be moved to this.done.
   * Tasks that are already dispatched, or not dispatchable right now will be
   * skipped.
   *
   * @param {Task=>boolean} callback
   *   A function that takes a Task, returns if the task is dispatchable, and
   *   dispatches the task if it is dispatchable.
   *
   * @return {boolean}
   *   True iff such a task was found and dispatched.
   */
  findAndDispatch(callback: (task: Task)=>boolean): boolean {
    var buf = [];

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

export default TaskMan;
