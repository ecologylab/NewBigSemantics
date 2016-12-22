// Task manager.

import * as events from 'events';
import * as LRU from 'lru-cache';
import { base32enc, sha256 } from '../utils/codec';
import * as logging from '../utils/logging';
import * as config from '../utils/config';
import { DPoolOptions } from './options';
import logger from './logging';
import { HttpResponse } from './httpRespParser';

let dpoolOptions = config.getOrThrow('dpool') as DPoolOptions;

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
  userAgent?: string;
  timePerAttempt?: number;
  maxAttempts?: number;

  /**
   * states:
   * - ready: ready to be dispatched to a worker.
   * - dispatched: dispatched to a worker; ongoing.
   * - finished: successfully done, and reported.
   * - terminated: unsuccessfully stopped after attempt(s), and reported.
   */
  state?: 'ready' | 'dispatched' | 'finished' | 'terminated';
  attempts?: number;
  response?: HttpResponse;

  constructor(proto: TaskProto) {
    super();
    this.url = proto.url;
    this.id = base32enc(sha256(Date.now() + '|' + proto.url)).substr(0, 10);

    this.userAgent = proto.userAgent || dpoolOptions.user_agent;
    this.maxAttempts = proto.maxAttempts || dpoolOptions.max_attempts,
    this.timePerAttempt = proto.timePerAttempt || dpoolOptions.time_per_attempt,

    this.state = 'ready';
  }
}

/**
 * Task manager.
 */
export default class TaskMan {

  private done: LRU.Cache<Task>;

  private tasks: Task[];

  constructor() {
    this.done = LRU<Task>({
      max: dpoolOptions.cache_size,
    });
    this.tasks = [];
  }

  newTask(proto: TaskProto): Task {
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
