import BSPhantom from './bscore';
import logger from './logging';
import { BaseDownloader } from './downloader';
import { Task } from './task';
import { logs } from '../bscore/logging';
import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';
import * as express from 'express';

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

function getResponse(req: express.Request, resp: Response, format?: string): string {
  if (format == "jsonp") {
    var callback = req.query.callback || null;

    return callback + "(" + simpl.serialize(resp) + ");";
  } else {
    return simpl.serialize(resp);
  }
}

function metadataFactory(bs: BSPhantom, format?: string): Middleware {
  var result: Middleware = function (req, res, next) {
    var url = req.query.url || req.query.uri;

    let task = new Task(url || req.originalUrl);
    task.log("task initiated");

    var response: Response = {
      id: task.id
    };

    copyParameters(req, response, task);

    if (url) {
      bs.loadMetadata(url, {}, (err, result) => {
        if (err) {
          task.log("task terminated", err);
          logger.error(task, "metadata extraction task failed");
          return next(new Error("An error occurred while processing your request."));
        }

        if (result.metadata) {
          task.log("task completed successfully");

          response.metadata = result.metadata    

          res.header("Content-Type", "application/json");
          res.send(getResponse(req, response, format));

          logger.info(task, "metadata extraction task succeeded");
        }
      });
    } else {
      task.log("no url provided");
      logger.warn(task, "metadata extraction task could not be completed - no url");

      return next(new Error("Parameter 'url' is required."));
    }
  };

  return result;
}

function repositoryFactory(bs: BSPhantom, format?: string): Middleware {
  var result: Middleware = function (req, res, next) {
    let task = new Task(req.originalUrl);
    task.log("task initiated");

    var response = {
      id: task.id,
      repository: bs.getRepo()["meta_metadata_repository"],
    };

    copyParameters(req, response, task);

    res.header("Content-Type", "application/json");
    res.send(getResponse(req, response, format));

    task.log("task completed successfully");
    logger.info(task, "mmdrepository task succeeded");
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
      bs.loadMmd(name, {}, mmdCallback);
    } else if (url) {
      task.log("mmd requested by url", url);
      bs.selectMmd(url, {}, mmdCallback);
    } else {
      task.log("failure: no name or url specified");
      logger.warn(task, "meta-metadata task could not be completed - no parameters");

      return next(new Error("Either 'url' or 'name' parameter required."));
    }

    function mmdCallback(err, result) {
      if(err) {
        task.log("task failed");
        logger.error(task, "meta-metadata task failed");

        return next(new Error("The requested Meta-Metadata could not be found."));
      }

      response.wrapper = result["meta_metadata"];

      res.header("Content-Type", "application/json");
      res.send(getResponse(req, response, format));

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

    var successes = 0;
    var warnings = 0;
    var failures = 0;

    for (var task of logs.records) {
      if (task.level == 40) {
        warnings += 1;
      } else if (task.level >= 50 && task.level <= 60) {
        failures += 1;
      } else {
        successes += 1;
      }
    }

    var response = {
      logs: logs.records,
      tasks: logs.records.length,
      successes: successes,
      warnings: warnings,
      failures: failures
    };

    res.send(JSON.stringify(response));
  };

  return result;
}

function taskDetailFactory(): Middleware {
  var result: Middleware = function (req, res, next) {
    let id = req.query.id;

    let task = logs.records.filter(log => log.id == id)[0];
    res.send(JSON.stringify(task));
  };

  return result;
}

// Necessary because express will not print message in production environment
var errorHandler: express.ErrorRequestHandler = function(err, req, res, next) {
  res.send(err.message);
}

/**
 * Instantiates the BigSemanticsService and returns the middleware functions
 * @param {(err: Error, result: MiddlewareSet) => void} callback
 * @param {any} repoSource - The location from which to obtain the mmd repository 
 */
export function create(callback: (err: Error, result: MiddlewareSet) => void, repoSource?: any): void {
  repoSource = repoSource || {
    url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
  };

  var options = {
    downloader: new BaseDownloader()
  };

  var bs = new BSPhantom(repoSource, options);

  bs.onReady((err, bs) => {
    if (err) {
      logger.error({ err: err }, "error starting BSPhantom");
      callback(err, null);
    } else {
      logger.info("BSPhantom ready");

      callback(null, {
        metadataJson: metadataFactory(bs),
        metadataJsonp: metadataFactory(bs, "jsonp"),

        repositoryJson: repositoryFactory(bs),
        repositoryJsonp: repositoryFactory(bs, "jsonp"),

        wrapperJson: wrapperFactory(bs),
        wrapperJsonp: wrapperFactory(bs, "jsonp"),

        tasksJson: taskListFactory(),
        taskJson: taskDetailFactory(),

        errorHandler: errorHandler
      });
    }
  });
}