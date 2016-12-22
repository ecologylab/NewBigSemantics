// The web server

/// <reference path="./xml.d.ts" />

import * as express from 'express';
import * as fs from 'fs';
import * as Promise from 'bluebird';
import * as xml from 'xml';
import logger from './logging';
import { TaskProto } from './taskMan';
import DownloaderPool from './dpool';

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
  return DownloaderPool.create().then(dpool => {
    dpool.start();
    return {
      download: downloadFactory(dpool),
      proxy: proxyFactory(dpool),
      workers: workersFactory(dpool),
      echo: echoFactory(),
      downloadJson: downloadJsonFactory(dpool),
      downloadXml: downloadXmlFactory(dpool),
    };
  }).catch(err => {
    logger.error(err, 'Error creating dpool middleware set');
    throw err; // for chained catch()
  });
}
