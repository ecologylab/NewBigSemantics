// The web server

/// <reference path="../../typings/index.d.ts" />
/// <reference path="./xml.d.ts" />

import * as express from 'express';
import * as xml from 'xml';
import DownloaderPool from './dpool';

interface Request extends express.Request {
  dpool: {
    task?: any;
  };
}

export interface Middleware {
  (req: Request, resp: express.Response, next: express.NextFunction): void;
}

interface MiddlewareFactory {
  (any): Middleware;
}

export interface MiddlewareSet {
  validateParams: Middleware;
  download: Middleware;
  proxy: Middleware;
  get: Middleware;          // deprecated
  downloadJson: Middleware; // deprecated
  downloadXml: Middleware;  // deprecated
}

var validateParams: Middleware = function(req, resp, next) {
  if (!req.query.url || req.query.url === '') {
    next(new Error("Parameter 'url' is required."));
    return;
  }

  req.dpool = req.dpool || {};
  req.dpool.task = {
    url: req.query.url,
    userAgent: req.query.agent,
  };
  if (req.query.attempts) {
    req.dpool.task.maxAttempts = Number(req.query.attempts);
  }
  if (req.query.timeout) {
    req.dpool.task.msPerAttempts = Number(req.query.timeout);
  }
  next();
}

var downloadFactory: MiddlewareFactory = function(dpool: DownloaderPool) {
  var result: Middleware = function(req, resp, next) {
    dpool.newTask(req.dpool.task, (err, task) => {
      if (err) {
        next(err);
        return;
      }

      if (task.response) {
        if (task.response.raw) {
          task.response.content = task.response.raw.toString();
          delete task.response.raw;
        }
      }
      resp.json(task);
      resp.end();
    });
  };
  return result;
}

var proxyFactory: MiddlewareFactory = function(dpool: DownloaderPool) {
  var result: Middleware = function(req, resp, next) {
    dpool.newTask(req.dpool.task, (err, task) => {
      if (task && task.response) {
        resp.status(task.response.code);
        task.response.headers.forEach(hdr => {
          resp.set(hdr.name, hdr.value);
        });
        resp.end(task.response.raw);
      } else {
        resp.status(500);
        resp.send(task);
        resp.end();
      }
    });
  };
  return result;
}

// Deprecated. For backward compatibility only.
var get: Middleware = function(req, resp, next) {
  var msg = req.query.msg;
  resp.send('Echo Message: ' + msg);
  resp.end();
}

// Deprecated. For backward compatibility only.
var downloadJsonFactory: MiddlewareFactory = function(dpool: DownloaderPool) {
  var result: Middleware = function(req, resp, next) {
    dpool.newTask(req.dpool.task, (err, task) => {
      if (err) {
        resp.status(500);
        resp.json(task);
        resp.end();
        return;
      }

      // generate JSON response
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
          attempt_time: task.msPerAttempt,

          url: req.query.url,

          response: {
            url: task.response.url,
            code: task.response.code,
            other_urls: (task.response.otherUrls || []).map(otherUrl => {
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
            content: task.response.content,
          }, // response

          // we have to skip logs for now, to not break JSON deserializer in Java.
          /*
          logs: (!task.logs) ? [] : task.logs.map(log => {
            return {
              datetime: log.datetime,
              name: log.name,
              args: JSON.stringify(log.args),
            };
          }),
          */
        }, // download_task
      }); // resp.send()
      resp.end();
    }); // dpool.newTask() callback
  };
  return result;
}

var downloadXmlFactory: MiddlewareFactory = function(dpool: DownloaderPool) {
  var result: Middleware = function(req, resp, next) {
    dpool.newTask(req.dpool.task, (err, task) => {
      if (err) {
        resp.status(500);
        resp.json(task);
        resp.end();
        return;
      }

      // generate XML response
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
              attempt_time: task.msPerAttempt,
            },
          },
          {
            url: req.query.url,
          },
          {
            response: [
              {
                _attr: {
                  url: task.response.url,
                  code: task.response.code,
                },
              },
              (!task.response.otherUrls) ? {} : {
                other_urls: task.response.otherUrls.map(otherUrl => {
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
                content: task.response.content,
              }
            ],
          },
          (!task.logs) ? {} : {
            logs: task.logs.map(log => {
              return {
                log: [
                  { datetime: log.datetime },
                  { name: log.name },
                  { args: JSON.stringify(log.args) },
                ],
              };
            }),
          },
        ],
      }));
      resp.end();
    });
  };
  return result;
}

export function create(callback: (err: Error, result: MiddlewareSet)=>void): void {
  DownloaderPool.create((err, dpool) => {
    var result: MiddlewareSet = {
      validateParams: validateParams,
      download: downloadFactory(dpool),
      proxy: proxyFactory(dpool),
      get: get,
      downloadJson: downloadJsonFactory(dpool),
      downloadXml: downloadXmlFactory(dpool),
    }
    dpool.start();
    callback(null, result);
  });
}
