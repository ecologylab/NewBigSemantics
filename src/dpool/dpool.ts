// The facade of downloader pool, as a library.

import * as Promise from 'bluebird';
import logger from './logging';
import Dispatcher from './dispatcher';
import Matcher, { DomainInterval } from './matcher';
import TaskMan, { TaskProto, Task } from './taskMan';
import WorkerMan, { WorkerProto } from './workerMan';

/**
 *
 */
export interface DownloaderPoolOptions {
  taskMan: TaskMan;
  workerMan: WorkerMan;
  matcher: Matcher;
  dispatcher: Dispatcher;
}

/**
 *
 */
export class DownloaderPool {

  private options: DownloaderPoolOptions;

  constructor(options: DownloaderPoolOptions) {
    this.options = options;
  }

  start(): void {
    this.options.workerMan.start();
    this.options.dispatcher.start();
  }

  stop(): void {
    this.options.dispatcher.stop();
    this.options.workerMan.stop();
  }

  newTask(task: TaskProto): Task {
    return this.options.taskMan.newTask(task);
  }

  getWorkers() {
    return this.options.workerMan.getWorkers();
  }

  newWorker(worker: WorkerProto): void {
    this.options.workerMan.newWorker(worker);
  }

  setDomainInterval(domain: string, interval: DomainInterval): void {
    this.options.matcher.setDomainInterval(domain, interval);
  }

}

export default DownloaderPool;
