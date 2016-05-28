// Matches a downloader (as a worker) and a task, based on access time.

/// <reference path="../typings/index.d.ts" />

import ParsedURL from '../BigSemanticsJavaScript/bsjsCore/ParsedURL';
import { Task, Worker, DomainInterval } from './types';
import logger from './logging';

export default class Matcher {

  private domainIntervals: { [domain: string]: DomainInterval };

  constructor() {
    this.domainIntervals = {};
  }

  setDomainInterval(domain: string, interval: any): void {
    this.domainIntervals[domain] = {
      domain: domain,
      min: interval.min,
    };
    logger.info(this.domainIntervals[domain], "set min interval");
  }

  matches(worker: Worker, task: Task): boolean {
    var purl = new ParsedURL(task.url);
    var domain = purl.domain;

    var interval = this.domainIntervals[domain];
    if (interval) {
      // if this domain has a mininum interval spec'ed.

      // if worker has no nextAccess table, create one
      if (!worker.nextAccess) {
        worker.nextAccess = {};
        logger.info({
          workerId: worker.id,
          domain: domain,
        }, "created nextAccess table");
      }

      // get the nextAccess time for this domain
      var nextAccess = worker.nextAccess[domain];
      if (nextAccess && Date.now() < nextAccess.getTime()) {
        // if the worker has a record of nextAccess time, and it's not yet that
        // time, matching fails.
        logger.info({
          url: task.url,
          workerId: worker.id,
          nextAccess: nextAccess,
        }, "cooling down");
        return false;
      }

      // otherwise, compute next access time and record to the worker
      worker.nextAccess[domain] = new Date(Date.now() + interval.min*(1+Math.random()*0.5));
      logger.info({
        domain: domain,
        workerId: worker.id,
        nextAccess: worker.nextAccess[domain],
      }, "new nextAccess");
    }

    // in the case of:
    // 1. no minimum interval spec'ed for this domain,
    // 2. worker has no nextAccess time for this domain,
    // 3. worker's nextAccess time for this domain has passed,
    // matching succeeds.
    return true;
  }

}
