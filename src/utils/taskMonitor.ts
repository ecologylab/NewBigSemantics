import { EventEmitter } from 'events';

/**
 * Bunyan compatible circular array for tasks
 * Also keeps track of basic statistics
 */
export default class TaskMonitor extends EventEmitter {
  capacity: number;
  size: number;

  private index: number;

  tasks: any[];

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
  write(task: any) {
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
        case 40: this.stats.warnings -= 1; break;
        case 50: case 60: this.stats.failures -= 1; break;
        default: this.stats.successes -= 1; break;
      }

      this.tasks[this.index] = task;
      this.index++;
    }

    switch (task.level) {
      case 40: this.stats.warnings += 1; break;
      case 50: case 60: this.stats.failures += 1; break;
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
   * Convenience function, returns the last {num} elements
   */
  getLast(num: number): any[] {
    // definitely not written properly
    let start = this.tasks.slice(this.index, this.index + num);
    let end = this.tasks.slice(0, this.index + 1);

   	let all = start.concat(end);
    return all.slice(all.length - num, all.length);
  }

  filter(predicate: (task) => boolean): any[] {
    return this.tasks.filter(predicate);
  }
}