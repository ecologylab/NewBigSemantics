// The facade of downloader pool, as a library.

/// <reference path="../typings/main.d.ts" />

import * as fs from 'fs';
import * as os from 'os';
import * as request from 'request';
import Dispatcher from './dispatcher';
import Matcher from './matcher';
import TaskMan from './taskMan';
import WorkerMan from './workerMan';
import { parseJson, loadConfig } from 'bigsemantics-utils';
import { Task } from './types';
import logger from './logging';

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

  newTask(task: any, callback: (error: Error, task: Task)=>void): void {
    this.taskMan.newTask(task, callback);
  }

  newWorker(worker: any): void {
    this.workerMan.newWorker(worker);
  }

  static create(callback: (err: Error, dpool: DownloaderPool)=>void): void {
    var dpool = new DownloaderPool();
    dpool.taskMan = new TaskMan();
    dpool.workerMan = new WorkerMan();
    dpool.matcher = new Matcher();
    dpool.dispatcher = new Dispatcher(dpool.taskMan, dpool.workerMan, dpool.matcher);

    var config = loadConfig('dpool-config.json');
    if (config instanceof Error) {
      logger.warn({ err: config as Error, }, "error loading config");
    } else {
      // add workers
      if (config.workerGroups) {
        config.workerGroups.forEach(group => {
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

      // load domain intervals
      if (config.mmdRepoUrl) {
        request(config.mmdRepoUrl, (err, resp, body) => {
          if (err) {
            logger.error({
              err: err,
              mmdRepoUrl: config.mmdRepoUrl,
            }, "error loading mmd repo");
            return callback(err, null);
          }

          var repo = parseJson(body);
          if (repo instanceof Error) {
            logger.error({
              err: err,
              mmdRepoUrl: config.mmdRepoUrl,
            }, "error parsing mmd repo");
            return callback(repo, null);
          }

          var sites = repo.meta_metadata_repository.sites;
          if (sites) {
            sites.forEach((site) => {
              dpool.matcher.setDomainInterval(site.domain, {
                min: site.min_download_interval * 1000,
              });
            });
          }

          callback(null, dpool);
        });

        return; // from create()
      }
    }

    callback(null, dpool);
  }

}

