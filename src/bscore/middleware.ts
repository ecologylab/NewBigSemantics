import BSPhantom from './bscore';
import logger from './logging';
import { BaseDownloader } from './downloader';
import { Task } from './task';
import { taskMon } from '../bscore/logging';
import * as request from 'request';
import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';
import * as express from 'express';
import * as fs from 'fs';

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
      bs.loadMetadata(url, { task: task }, (err, result) => {
        if (err) {
          task.log("task terminated", err);
          logger.error(task, "metadata extraction task failed");

          return next(new Error("An error occurred while processing your request."));
        }

        if (result && result.metadata) {
          task.dpoolTasks = result.metadata.dpoolTasks;
          delete result.metadata.dpoolTasks;
        }

        if (result.metadata) {
          task.log("task completed successfully");

          response.metadata = result.metadata

          sendResponse(req, res, response, format);

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

    res.contentType('application/json');
    sendResponse(req, res, response, format);

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
      if (err) {
        task.log("task failed");
        logger.error(task, "meta-metadata task failed");

        return next(new Error("The requested Meta-Metadata could not be found."));
      }

      response.wrapper = result["meta_metadata"];

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
  
  var repoSource = options.repoSource || {
    url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
  };

  options.downloader = new BaseDownloader();

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

        agentsInfoJson: agentsInfoFactory(bs),
        downloadersInfoJson: downloadersInfoFactory(),

        errorHandler: errorHandler
      });
    }
  });
}