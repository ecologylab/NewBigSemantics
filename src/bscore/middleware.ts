import * as request from 'request';
import * as express from 'express';
import * as fs from 'fs';
import * as simpl from 'simpl.js';
import RepoMan from "../core/RepoMan";
import { Metadata } from "../core/types";
import logger from './logging';
import { taskMon } from '../bscore/logging';
import { Task } from './task';
import BSPhantom from './bscore';
import RequestDownloader from './request-downloader';
import { MetadataCache } from "./cache";

export interface Middleware {
  (req: express.Request, resp: express.Response, next: express.NextFunction): void;
}

export interface MiddlewareSet {
  metadataJson: Middleware;
  metadataJsonp: Middleware;

  repositoryJson: Middleware;
  repositoryJsonp: Middleware;

  wrapperJson: Middleware;
  wrapperJsonp: Middleware;

  tasksJson: Middleware;
  taskJson: Middleware;

  agentsInfoJson: Middleware;
  downloadersInfoJson: Middleware;

  errorHandler: express.ErrorRequestHandler;
}

interface Response {
  id?: string;
  repository?: any;
  metadata?: any;
  wrapper?: any;
  appId?: string;
  userId?: string;
  sessionId?: string;
  reqId?: string;
}

function copyParameters(req: express.Request, resp: Response, task: Task) {
  resp.appId = req.query.aid;
  resp.userId = req.query.uid;
  resp.sessionId = req.query.sid;
  resp.reqId = req.query.rid;

  // include in task, for viewing in the dashboard
  task.reqIp = req.ip;
  task.appId = req.query.aid;
  task.userId = req.query.uid;
  task.sessionId = req.query.sid;
  task.reqId = req.query.rid;
}

function sendResponse(req: express.Request, res: express.Response, data: Response, format?: string) {
  if(format == "jsonp") {
    var callback = req.query.callback || null;

    res.contentType("application/javascript");
    res.send(callback + "(" + simpl.serialize(data) + ")");
  } else {
    res.contentType("application/json");
    res.send(simpl.serialize(data));
  }
}

function metadataFactory(bs: BSPhantom, cache: MetadataCache, format?: string): Middleware {
  var result: Middleware = function (req, res, next) {
    var url = req.query.url || req.query.uri;

    let task = new Task(url || req.originalUrl);
    task.log("task initiated");

    var response: Response = {
      id: task.id
    };

    copyParameters(req, response, task);

    if (url) {
      // readThrough function that cache will use if Metadata not found
      let readThrough = (url: string) => {
        return new Promise((resolve, reject) => {
          bs.loadMetadata(url, { task: task })
          .then(result => resolve(result))
          .catch(err => reject(err));
        });
      };

      cache.get(url, readThrough).then(result => {
        if(result && result.metadata) {
          task.dpoolTasks = result.metadata.dpoolTasks;
          delete result.metadata.dpoolTasks;

          task.log("task completed successfully");
          response.metadata = result.metadata
          sendResponse(req, res, response, format);
          logger.info(task, "metadata extraction task succeeded");
        }
      }).catch(err => {
        task.log("task terminated", err);
        logger.error(task, "metadata extraction task failed");

        return next(new Error("An error occurred while processing your request."));
      });
    } else {
      task.log("no url provided");
      logger.warn(task, "metadata extraction task could not be completed - no url");

      return next(new Error("Parameter 'url' is required."));
    }
  };

  return result;
}

var cachedRepo = null;
function repositoryFactory(bs: BSPhantom, format: string): Middleware {
  var result: Middleware = function (req, res, next) {
    let task = new Task(req.originalUrl);
    task.log("task initiated");

    bs.getRepository().then(typedRepo => {
      var response = {
        repository: typedRepo.meta_metadata_repository,
      };

      if(format == "json") {
        if(cachedRepo == null) {
          cachedRepo = simpl.serialize(response);
        }

        res.contentType('application/json');
        res.send(cachedRepo);
        return;
      }

      copyParameters(req, response, task);

      res.contentType('application/json');
      sendResponse(req, res, response, format);

      task.log("task completed successfully");
      logger.info(task, "mmdrepository task succeeded");
    });
  }
  return result;
}

function wrapperFactory(bs: BSPhantom, format?: string): Middleware {
  var result: Middleware = function (req, res, next) {
    var name = req.query.name;
    var url = req.query.url || req.query.uri;

    let task = new Task(req.originalUrl);
    task.log("task initiated");

    var response: Response = {
      id: task.id
    };

    copyParameters(req, response, task);

    if (name) {
      task.log("mmd requested by name", name);
      bs.loadMmd(name, {})
      .then(result => mmdCallback(undefined, result))
      .catch(err => mmdCallback(err, undefined));
    } else if (url) {
      task.log("mmd requested by url", url);
      bs.selectMmd(url, {})
      .then(result => mmdCallback(undefined, result))
      .catch(err => mmdCallback(err, undefined));
    } else {
      task.log("failure: no name or url specified");
      logger.warn(task, "meta-metadata task could not be completed - no parameters");

      return next(new Error("Either 'url' or 'name' parameter required."));
    }

    function mmdCallback(err, result) {
      if (err) {
        task.log("task failed");
        logger.error(task, "meta-metadata task failed");

        return next(new Error("The requested Meta-Metadata could not be found."));
      }

      if (result.wrapper) {
        response.wrapper = result.wrapper;
      } else if (result.meta_metadata) {
        response.wrapper = result.meta_metadata;
      } else if (result.mmd) {
        response.wrapper = result.mmd;
      }

      sendResponse(req, res, response, format);

      task.log("task completed successfully");
      logger.info(task, "meta-metadata request succeeded");
    }
  }

  return result;
}

function taskListFactory(): Middleware {
  var result: Middleware = function (req, res, next) {
    var page = parseInt(req.query.page);
    if (!page) page = 0;

    var response = {
      tasks: taskMon.getLast(50),
      numTasks: taskMon.size,
      successes: taskMon.stats.successes,
      warnings: taskMon.stats.warnings,
      failures: taskMon.stats.failures
    };

    res.send(response);
  };

  return result;
}

function taskDetailFactory(): Middleware {
  var result: Middleware = function (req, res, next) {
    let id = req.query.id;

    let task = taskMon.filter(log => log.id == id)[0];
    res.json(task);
  };

  return result;
}

function agentsInfoFactory(bs: BSPhantom): Middleware {
  var result: Middleware = function (req, res, next) {
    let id = req.query.id;

    let agents = bs.getMaster().agentsInfo();
    res.json({ agents: agents });
  };

  return result;
}

// Retrieves the downloader worker information from the dpool
// necessary because can't access different port from web page
function downloadersInfoFactory(): Middleware {
  var result: Middleware = function(req, res, next) {
    request("http://localhost:3000/workers.json", null, (err, resp, body) => {
      if(!err && resp.statusCode == 200) {
        res.contentType("application/json");
        res.end(body);
      } else {
        res.status(500);
        res.end(JSON.stringify(err));
      }
    });
  };

  return result;
}

// Necessary because express will not print message in production environment
var errorHandler: express.ErrorRequestHandler = function (err, req, res, next) {
  res.send(err.message);
}

/**
 * Instantiates the BigSemanticsService and returns the middleware functions
 * @param {(err: Error, result: MiddlewareSet) => void} callback
 * @param {any} repoSource - The location from which to obtain the mmd repository
 */
export function create(callback: (err: Error, result: MiddlewareSet) => void, options?: any): void {
  options = options || {};
  options.downloader = new RequestDownloader();

  let cacheSettings = options.metadata_cache;

  var bs = new BSPhantom();
  bs.load(options);

  bs.onReady((err, bs) => {
    let repoMan = bs.getRepoMan();
    // repoMan.load(bs.getRepo() as any, {});
    //let repoMan = new RepoMan({ repo: bs.getRepo() }, null);

    repoMan.getRepository().then(repo => {
      let cache = new MetadataCache({
        repoMan: repoMan as any,
        mmdRepo: repo,

        mongo: {
          url: options.mongoUrl,
          collection: cacheSettings.cache_collection
        }
      });

      cache.connect().catch(err => {
        logger.fatal({ err: err }, "Could not connect to cache");
      });

      if (err) {
        logger.error({ err: err }, "error starting BSPhantom");
        callback(err, null);
      } else {
        logger.info("BSPhantom ready");

        callback(null, {
          metadataJson: metadataFactory(bs, cache, "json"),
          metadataJsonp: metadataFactory(bs, cache, "jsonp"),

          repositoryJson: repositoryFactory(bs, "json"),
          repositoryJsonp: repositoryFactory(bs, "jsonp"),

          wrapperJson: wrapperFactory(bs, "json"),
          wrapperJsonp: wrapperFactory(bs, "jsonp"),

          tasksJson: taskListFactory(),
          taskJson: taskDetailFactory(),

          agentsInfoJson: agentsInfoFactory(bs),
          downloadersInfoJson: downloadersInfoFactory(),

          errorHandler: errorHandler
        });
      }
    });
  });
}
