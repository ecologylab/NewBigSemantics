/**
 * Logging utility.
 */

import { EventEmitter } from 'events';
import * as bunyan from 'bunyan';

// Errors are not JSON serializable by default
// So create a toJSON prototype for Error
//
// http://stackoverflow.com/a/18391400
if (!('toJSON' in Error.prototype)) {
  Object.defineProperty(Error.prototype, 'toJSON', {
    value: function () {
      var alt = {};

      Object.getOwnPropertyNames(this).forEach(function (key) {
        alt[key] = this[key];
      }, this);

      return alt;
    },
    configurable: true,
    writable: true
  });
}

/**
 * A generic log record.
 */
export interface Log {
  datetime: Date;
  name: string;
  args?: any;
}

/**
 * A generic task, for use in TaskMonitor.
 */
export class Task extends EventEmitter {
  level: number = bunyan.INFO;
  logs: Log[];

  /**
   * @param {string} name
   * @param {any} args
   */
  log(name: string, args?: any): void {
    if (!this.logs) this.logs = [];
    let argsObj = args;
    if (args instanceof Error) {
      this.level = bunyan.WARN;
      argsObj = { error: args };
    }
    this.logs.push({
      datetime: new Date(),
      name: name,
      args: argsObj,
    });
  }

  // this seems to be necessary for the task object to properly log
  toJSON() {
    var alt = {};

    Object.getOwnPropertyNames(this).forEach(function (key) {
      alt[key] = this[key];
    }, this);

    return alt;
  }
}

/**
 * Bunyan compatible circular array for tasks
 * Also keeps track of basic statistics
 */
export class TaskMonitor<T extends Task> extends EventEmitter {
  capacity: number;
  size: number;

  private index: number;

  tasks: T[];

  stats: {
    successes: number;
    failures: number;
    warnings: number;
  }

  constructor(capacity: number) {
    super();

    this.capacity = capacity;
    this.size = 0;
    this.index = 0;
    this.tasks = [];

    this.stats = {
      successes: 0,
      failures: 0,
      warnings: 0
    }

    EventEmitter.call(this);
  }

  /**
   * Implementation of EventEmitter.write
   */
  write(task: T) {
    // add new item to array
    if (this.tasks[this.index] == undefined) {
      this.tasks[this.index] = task;
      this.size++;
      this.index++;

      if (this.index >= this.capacity) {
        this.index = 0;
      }
    } else {
      // 'delete' this task from array, so remote it from stats
      switch (this.tasks[this.index].level) {
        case bunyan.WARN: this.stats.warnings -= 1; break;
        case bunyan.ERROR: case bunyan.FATAL: this.stats.failures -= 1; break;
        default: this.stats.successes -= 1; break;
      }

      this.tasks[this.index] = task;
      this.index++;
    }

    switch (task.level) {
      case bunyan.WARN: this.stats.warnings += 1; break;
      case bunyan.ERROR: case bunyan.FATAL: this.stats.failures += 1; break;
      default: this.stats.successes += 1; break;
    }
  }

  end() { }

  destroy() {
    delete this.tasks;
    this.emit("close");
  }

  destroySoon() {
    this.destroy();
  }

  /**
   * @param {number} num
   * @returns the last {num} elements
   */
  getLast(num: number): T[] {
    // definitely not written properly
    let start = this.tasks.slice(this.index, this.index + num);
    let end = this.tasks.slice(0, this.index + 1);

   	let all = start.concat(end);
    return all.slice(all.length - num, all.length);
  }

  filter(predicate: (task) => boolean): T[] {
    return this.tasks.filter(predicate);
  }
}
