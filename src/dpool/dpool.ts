// The facade of downloader pool, as a library.

import * as os from 'os';
import * as request from 'request';
import * as Promise from 'bluebird';
import { Repository } from '../core/types';
import * as config from '../utils/config';
import { DPoolOptions } from './options';
import logger from './logging';
import Dispatcher from './dispatcher';
import Matcher from './matcher';
import TaskMan, { TaskProto, Task } from './taskMan';
import WorkerMan, { WorkerProto } from './workerMan';

let dpoolOptions = config.getOrFail('dpool', logger) as DPoolOptions;

/**
 *
 */
export default class DownloaderPool {

  private taskMan: TaskMan;
  private workerMan: WorkerMan;
  private matcher: Matcher;
  private dispatcher: Dispatcher;

  start(): void {
    this.workerMan.start();
    this.dispatcher.start();
  }

  stop(): void {
    this.dispatcher.stop();
    this.workerMan.stop();
  }

  newTask(task: TaskProto): Task {
    return this.taskMan.newTask(task);
  }

  getWorkers() {
    return this.workerMan.getWorkers();
  }

  newWorker(worker: WorkerProto): void {
    this.workerMan.newWorker(worker);
  }

  static create(): Promise<DownloaderPool> {
    return new Promise<DownloaderPool>((resolve, reject) => {
      let dpool = new DownloaderPool();
      dpool.taskMan = new TaskMan();
      dpool.workerMan = new WorkerMan();
      dpool.matcher = new Matcher();
      dpool.dispatcher = new Dispatcher(dpool.taskMan, dpool.workerMan, dpool.matcher);

      // add workers
      if (dpoolOptions.worker_groups) {
        dpoolOptions.worker_groups.forEach(group => {
          group.hosts.forEach(host => {
            dpool.workerMan.newWorker({
              host: host,
              port: group.port,
              user: group.user,
              identity: group.identity.replace('$HOME', os.homedir()),
            });
          });
        });
      }

      if (!dpoolOptions.repository_url) {
        resolve(dpool);
        return;
      }

      // load domain intervals
      request(dpoolOptions.repository_url, (err, resp, body) => {
        if (err) {
          logger.error({
            err: err,
            mmdRepoUrl: dpoolOptions.repository_url,
          }, "error loading mmd repo");
          reject(err);
          return;
        }

        let repo: Repository = null;
        try {
          let resp: any = JSON.parse(body);
          if (resp.repository) resp = resp.repository;
          if (resp.meta_metadata_repository) resp = resp.meta_metadata_repository;
          repo = resp as Repository;
        } catch (err) {
          logger.error({
            err: err,
            mmdRepoUrl: dpoolOptions.repository_url,
          }, "error parsing mmd repo");
          reject(err);
          return;
        }

        if (repo.sites) {
          repo.sites.forEach(site => {
            dpool.matcher.setDomainInterval(site.domain, {
              min: site.min_download_interval * 1000,
            });
          });
        }

        resolve(dpool);
      });
    });
  }

}
