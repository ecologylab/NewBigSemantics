import BSPhantom from './bscore';
import logger from './logging';
import { BaseDownloader } from './downloader';
import { Task } from './task';
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

  errorHandler: express.ErrorRequestHandler;
}

interface Response {
  id?: string;
  repository?: any;
  metadata?: any;
  appId?: string;
  userId?: string;
  sessionId?: string;
  reqId?: string;
}

function getResponse(req: express.Request, resp: Response, format?: string): string {
  resp.appId = req.query.aid;
  resp.userId = req.query.uid;
  resp.sessionId = req.query.sid;
  resp.reqId = req.query.rid;

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

    if (url) {
      let task = new Task(url);

      task.log("task initiated");
      bs.loadMetadata(url, {}, (err, result) => {
        if (err) {
          task.log("task terminated", { err: err });
          logger.error(task, "metadata extraction task failed");
        }

        if (result.metadata) {
          task.log("task completed successfully");

          var response: Response = {
            id: task.id,
            metadata: result.metadata
          };

          res.header("Content-Type", "application/json");
          res.send(getResponse(req, response, format));

          logger.info(task, "metadata extraction task succeeded");
        }
      });
    } else {
      next(new Error("Parameter 'url' is required."));
    }
  };

  return result;
}

function repositoryFactory(bs: BSPhantom, format?: string): Middleware {
  var result: Middleware = function (req, res, next) {
    let task = new Task(req.baseUrl);
    task.log("task initiated");

    var response = {
      id: task.id,
      repository: bs.getRepo()["meta_metadata_repository"],
    };

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

    let task = new Task(req.baseUrl);
    task.log("task initiated");

    if (name) {
      task.log("mmd requested by name", name);
      bs.loadMmd(name, {}, mmdCallback);
    } else if (url) {
      task.log("mmd requested by url", url);
      bs.selectMmd(url, {}, mmdCallback);
    } else {
      task.log("failure: no name or url specified");
      logger.warn(task, "mmd task could not be completed");

      return next(new Error("Either 'url' or 'name' parameter required."));
    }

    function mmdCallback(err, result) {
      if(err) {
        task.log("task failed");
        logger.error(task, "mmd task failed");

        return next(new Error("The requested Meta-Metadata could not be found."));
      }

      var response = {
        id: task.id,
        wrapper: result["meta_metadata"]
      };

      res.header("Content-Type", "application/json");
      res.send(getResponse(req, response, format));

      task.log("task completed successfully");
      logger.info(task, "meta-metadata request succeeded");
    }
  }

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

        errorHandler: errorHandler
      });
    }
  });
}