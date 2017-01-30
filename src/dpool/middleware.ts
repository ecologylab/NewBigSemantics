// The web server

/// <reference path="./xml.d.ts" />

import * as fs from 'fs';
import * as os from 'os';
import * as express from 'express';
import * as Promise from 'bluebird';
import * as request from 'request';
import * as xml from 'xml';
import * as simpl from 'simpl.js';
import { Repository } from '../core/types';
import * as config from '../utils/config';
import { DPoolOptions } from './options';
import { logger, taskMon } from './logging';
import { TaskProto, TaskMan } from './taskMan';
import { WorkerMan } from './workerMan';
import { Matcher } from './matcher';
import { Dispatcher } from './dispatcher';
import DownloaderPool from './dpool';

let dpoolOptions = config.getOrFail('dpool', logger) as DPoolOptions;

/**
 *
 */
export interface Request extends express.Request {
  dpool: {
    task: TaskProto;
  };
}

/**
 *
 */
export interface Middleware {
  (req: Request, resp: express.Response, next: express.NextFunction): void;
}

/**
 *
 */
export interface MiddlewareSet {
  download: Middleware;
  proxy: Middleware;
  workers: Middleware;
  taskInfo: Middleware;

  /**
   * @deprecated
   */
  echo?: Middleware;

  /**
   * @deprecated
   */
  downloadJson?: Middleware;

  /**
   * @deprecated
   */
  downloadXml?: Middleware;
}

/**
 * @param {Request} req
 */
function preprocessRequest(req: Request): void {
  req.dpool = req.dpool || {
    task: {
      url: req.query.url || req.query.uri,
    },
  };
  if (req.query.agent) {
    req.dpool.task.userAgent = req.query.agent;
  }
  if (req.query.attempts) {
    req.dpool.task.maxAttempts = Number(req.query.attempts);
  }
  if (req.query.timeout) {
    req.dpool.task.timePerAttempt = Number(req.query.timeout);
  }
}

function taskInfoFactory(): Middleware {
  return (req, resp, next) => {
    if(!req.query.id) {
      throw new Error("Missing required parameter 'id'");
    }

    let matchingTasks = taskMon.filter(task => task.id === req.query.id);

    if(matchingTasks.length === 0) {
      throw new Error(`No matching task found for id ${req.query.id}`);
    }

    resp.json(matchingTasks[0]);
  };
} 

/**
 * @param {Error} err
 * @param {NextFunction} next
 */
function logError(err: Error, next: express.NextFunction): void {
  logger.warn(err);
  next(err);
}

/**
 * @param {DownloaderPool} dpool
 * @return {Middleware}
 */
function downloadFactory(dpool: DownloaderPool): Middleware {
  return function(req, resp, next) {
    if (!req.query.url && !req.query.uri) {
      throw new Error("Missing required query 'url'");
    }
    preprocessRequest(req);
    let task = dpool.newTask(req.dpool.task);
    task.on('finish', () => {
      if (task.response) {
        if (task.response.raw) {
          task.response.content = task.response.raw.toString();
          delete task.response.raw;
        }
      }
      resp.json(task);
    });
    task.on('error', err => {
      logError(err, next);
    });
    task.on('terminated', () => {
      logError(new Error("Task is terminated due to too many errors"), next);
    });
  };
}

/**
 * @param {DownloaderPool} dpool
 * @return {Middleware}
 */
function proxyFactory(dpool: DownloaderPool): Middleware {
  return function(req, resp, next) {
    if (!req.query.url && !req.query.uri) {
      throw new Error("Missing required query 'url'");
    }
    preprocessRequest(req);
    let task = dpool.newTask(req.dpool.task);
    task.on('finish', () => {
      if (!task.response) {
        throw new Error("Response missing!");
      }

      resp.status(task.response.code);
      task.response.headers.forEach(hdr => {
        resp.set(hdr.name, hdr.value);
      });
      resp.set('X-Task-Info', task.id);
      resp.send(task.response.raw);
    });
    task.on('error', err => {
      logError(err, next);
    });
    task.on('terminated', () => {
      logError(new Error("Task is terminated due to too many errors"), next);
    });
  };
}

/**
 * @param {DownloaderPool} dpool
 * @return {Middleware}
 */
function workersFactory(dpool: DownloaderPool): Middleware {
  return function(req, resp, next) {
    resp.json(dpool.getWorkers());
  };
}

/**
 * @param {DownloaderPool} dpool
 * @return {Middleware}
 * @deprecated
 */
function echoFactory(): Middleware {
  return function(req, resp, next) {
    if (!req.query.msg) {
      throw new Error("Missing required query 'msg'");
    }
    var msg = req.query.msg;
    resp.send('Echo Message: ' + msg);
  };
}

/**
 * @param {DownloaderPool} dpool
 * @return {Middleware}
 * @deprecated
 */
function downloadJsonFactory(dpool: DownloaderPool): Middleware {
  return function(req, resp, next) {
    if (!req.query.url && !req.query.uri) {
      throw new Error("Missing required query 'url'");
    }
    preprocessRequest(req);
    let task = dpool.newTask(req.dpool.task);
    task.on('finish', () => {
      if (!task.response) {
        throw new Error("Response missing!");
      }

      if (task.response.raw) {
        task.response.content = task.response.raw.toString();
        delete task.response.raw;
      }

      resp.type('json');
      resp.send({
        download_task: {
          id: task.id,
          state: task.state === 'finished' ? 'SUCCEEDED' : 'TERMINATED',
          user_agent: task.userAgent,
          max_attempts: task.maxAttempts,
          attempt_time: task.timePerAttempt,

          url: req.query.url,

          response: {
            url: task.response.location,
            code: task.response.code,
            other_urls: (task.response.otherLocations || []).map(otherUrl => {
              return {
                other_url: otherUrl,
              };
            }),
            headers: (task.response.headers || []).map(hdr => {
              return {
                name: hdr.name,
                value: hdr.value,
              };
            }),
            content: task.response['content'],
          },
        },
      });
    });
    task.on('error', err => {
      logError(err, next);
    });
    task.on('terminated', () => {
      logError(new Error("Task is terminated due to too many errors"), next);
    });
  };
}

/**
 * @param {DownloaderPool} dpool
 * @return {Middleware}
 * @deprecated
 */
function downloadXmlFactory(dpool: DownloaderPool): Middleware {
  return function(req, resp, next) {
    if (!req.query.url && !req.query.uri) {
      throw new Error("Missing required query 'url'");
    }
    preprocessRequest(req);
    let task = dpool.newTask(req.dpool.task);
    task.on('finish', () => {
      if (!task.response) {
        throw new Error("Response missing!");
      }

      if (task.response.raw) {
        task.response.content = task.response.raw.toString();
        delete task.response.raw;
      }

      resp.type('xml');
      resp.send(xml({
        download_task: [
          {
            _attr: {
              id: task.id,
              state: task.state === 'finished' ? 'SUCCEEDED' : 'TERMINATED',
              user_agent: task.userAgent,
              max_attempts: task.maxAttempts,
              attempt_time: task.timePerAttempt,
            },
          },
          {
            url: req.query.url,
          },
          {
            response: [
              {
                _attr: {
                  url: task.response.location,
                  code: task.response.code,
                },
              },
              (!task.response.otherLocations) ? {} : {
                other_urls: task.response.otherLocations.map(otherUrl => {
                  return {
                    other_url: otherUrl,
                  };
                }),
              },
              (!task.response.headers) ? {} : {
                headers: task.response.headers.map(hdr => {
                  return {
                    header: {
                      _attr: {
                        name: hdr.name,
                        value: hdr.value,
                      },
                    },
                  };
                }),
              },
              {
                content: task.response['content'],
              }
            ],
          },
        ],
      }));
    });
    task.on('error', err => {
      logError(err, next);
    });
    task.on('terminated', () => {
      logError(new Error("Task is terminated due to too many errors"), next);
    });
  };
}

/**
 * @return {Promise<MiddlewareSet>}
 */
export default function create(): Promise<MiddlewareSet> {
  return new Promise<DownloaderPool>((resolve, reject) => {
    let taskMan = new TaskMan(dpoolOptions);
    let workerMan = new WorkerMan(dpoolOptions);
    let matcher = new Matcher();
    let dispatcher = new Dispatcher({
      taskMan: taskMan,
      workerMan: workerMan,
      matcher: matcher,
      dispatchingInterval: dpoolOptions.dispatchingInterval,
    });
    let dpool = new DownloaderPool({
      taskMan: taskMan,
      workerMan: workerMan,
      matcher: matcher,
      dispatcher: dispatcher,
    });

    // add workers
    if (dpoolOptions.workerGroups) {
      dpoolOptions.workerGroups.forEach(group => {
        group.hosts.forEach(host => {
          dpool.newWorker({
            host: host,
            port: group.port,
            user: group.user,
            identity: group.identity ? group.identity.replace('$HOME', os.homedir()) : undefined,
          });
        });
      });
    }

    if (!dpoolOptions.repositoryUrl) {
      resolve(dpool);
      return;
    }

    request(dpoolOptions.repositoryUrl, (err, resp, body) => {
      if (err) {
        logger.error({
          err: err,
          mmdRepoUrl: dpoolOptions.repositoryUrl,
        }, "Error loading mmd repo");
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
          mmdRepoUrl: dpoolOptions.repositoryUrl,
        }, "Error parsing mmd repo");
        reject(err);
        return;
      }

      if (repo.sites) {
        repo.sites.forEach(site => {
          dpool.setDomainInterval(site.domain, {
            min: site.min_download_interval * 1000,
          });
        });
      }

      resolve(dpool);
    });
  }).then(dpool => {
    dpool.start();
    return {
      download: downloadFactory(dpool),
      proxy: proxyFactory(dpool),
      workers: workersFactory(dpool),
      taskInfo: taskInfoFactory(),
      echo: echoFactory(),
      downloadJson: downloadJsonFactory(dpool),
      downloadXml: downloadXmlFactory(dpool),
    };
  }).catch(err => {
    logger.error(err, 'Error creating dpool middleware set');
    throw err; // for chained catch()
  });
}
