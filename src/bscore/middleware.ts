/**
 * express.RequestHandler for handling BigSemantics service requests.
 */

import * as fs from 'fs';
import * as Promise from 'bluebird';
import * as request from 'request';
import { Request, Response, RequestHandler, ErrorRequestHandler } from 'express';
import * as simpl from 'simpl.js';
import logger, { taskMon } from './logging';
import { MetaMetadata, Repository, TypedRepository, Metadata, BSResult } from '../core/types';
import RepoMan from '../core/RepoMan';
import { Downloader } from '../core/Downloader';
import RequestDownloader from './request-downloader';
import { MetadataCache } from './cache';
import BSPhantom, { BSPhantomOptions } from './bscore';
import { Task } from './task';


/**
 *
 */
export interface MiddlewareSet {
  metadataJson: RequestHandler;
  metadataJsonp: RequestHandler;

  repositoryJson: RequestHandler;
  repositoryJsonp: RequestHandler;

  wrapperJson: RequestHandler;
  wrapperJsonp: RequestHandler;

  tasksJson: RequestHandler;
  taskJson: RequestHandler;

  agentsInfoJson: RequestHandler;
  downloadersInfoJson: RequestHandler;

  errorHandler: ErrorRequestHandler;
}

/**
 * @param {express.Request} req
 * @param {Task} task
 */
function copyParameters(req: Request, task: Task): void {
  // include in task, for viewing in the dashboard
  task.reqIp = req.ip;
  task.appId = req.query.aid;
  task.appVer = req.query.av;
  task.userId = req.query.uid;
  task.sessionId = req.query.sid;
  task.reqId = req.query.rid;
}

/**
 * @param {Request} req
 * @param {Response} res
 * @param {BSResult} data
 * @param {string} format
 */
function sendResponse(req: Request, res: Response, data: BSResult, format?: string): void {
  if(format == "jsonp") {
    var callback = req.query.callback || null;
    res.contentType("application/javascript");
    res.send(callback + "(" + simpl.serialize(data) + ")");
  } else {
    res.contentType("application/json");
    res.send(simpl.serialize(data));
  }
}

/**
 * @param {BSPhantom} bs
 * @param {MetadataCache} cache
 * @param {string} format
 * @return {RequestHandler}
 */
function metadataFactory(bs: BSPhantom, cache: MetadataCache, format?: string): RequestHandler {
  var result: RequestHandler = (req, res, next) => {
    var url = req.query.url || req.query.uri;

    let task = new Task(url || req.originalUrl);
    task.log("task initiated");

    var response: BSResult = {};

    copyParameters(req, task);

    if (url) {
      // readThrough function that cache will use if Metadata not found
      let readThrough = (url: string) => {
        return new Promise((resolve, reject) => {
          bs.loadMetadata(url, { task: task })
          .then(result => resolve(result))
          .catch(err => reject(err));
        });
      };

      cache.get(url, readThrough as any).then(result => {
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

/**
 * @type {string}
 */
var cachedRepo: string = null;

/**
 * @param {BSPhantom} bs
 * @param {string} format
 * @return {RequestHandler}
 */
function repositoryFactory(bs: BSPhantom, format: string): RequestHandler {
  var result: RequestHandler = (req, res, next) => {
    let task = new Task(req.originalUrl);
    task.log("task initiated");

    bs.getRepository().then(repo => {
      var response = {
        repository: repo,
      };

      if(format == "json") {
        if(cachedRepo == null) {
          cachedRepo = simpl.serialize(response);
        }

        res.contentType('application/json');
        res.send(cachedRepo);
        return;
      }

      copyParameters(req, task);

      res.contentType('application/json');
      sendResponse(req, res, response, format);

      task.log("task completed successfully");
      logger.info(task, "mmdrepository task succeeded");
    });
  }
  return result;
}

/**
 * @param {BSPhantom} bs
 * @param {string} format
 * @return {RequestHandler}
 */
function wrapperFactory(bs: BSPhantom, format?: string): RequestHandler {
  var result: RequestHandler = (req, res, next) => {
    var name = req.query.name;
    var url = req.query.url || req.query.uri;

    let task = new Task(req.originalUrl);
    task.log("task initiated");

    var response: BSResult = {};

    copyParameters(req, task);

    let promisedResult: Promise<MetaMetadata> =  null;

    if (name) {
      task.log("mmd requested by name", name);
      promisedResult = bs.loadMmd(name);
    } else if (url) {
      task.log("mmd requested by url", url);
      promisedResult = bs.selectMmd(url);
    } else {
      task.log("failure: no name or url specified");
      logger.warn(task, "meta-metadata task could not be completed - no parameters");
      return next(new Error("Either 'url' or 'name' parameter required."));
    }

    if (promisedResult) {
      promisedResult.then(mmd => {
        task.log("task completed successfully");
        logger.info(task, "meta-metadata request succeeded");
        response.mmd = mmd;
        sendResponse(req, res, response, format);
      }).catch(err => {
        task.log("task failed");
        logger.error(task, "meta-metadata task failed");
        next(new Error("The requested Meta-Metadata could not be found."));
      });
    }
  }

  return result;
}

/**
 * @return {RequestHandler}
 */
function taskListFactory(): RequestHandler {
  var result: RequestHandler = function (req, res, next) {
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

/**
 * @return {express.RequestHandler}
 */
function taskDetailFactory(): RequestHandler {
  var result: RequestHandler = function (req, res, next) {
    let id = req.query.id;

    let task = taskMon.filter(log => log.id == id)[0];
    res.json(task);
  };

  return result;
}

/**
 * @param {BSPhantom} bs
 * @return {RequestHandler}
 */
function agentsInfoFactory(bs: BSPhantom): RequestHandler {
  var result: RequestHandler = function (req, res, next) {
    let id = req.query.id;

    let agents = bs.getMaster().agentsInfo();
    res.json({ agents: agents });
  };

  return result;
}

/**
 * Retrieves the downloader worker information from the dpool.
 * Necessary because can't access different port from web page.
 * @return {RequestHandler}
 */
function downloadersInfoFactory(): RequestHandler {
  var result: RequestHandler = function(req, res, next) {
    // FIXME find host and port from config
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

/**
 * Necessary because express will not print message in production environment.
 * @param {any} err [description]
 * @param {Request} req [description]
 * @param {Response} res [description]
 * @param {NextFunction} next [description]
 */
var errorHandler: ErrorRequestHandler = function (err, req, res, next): void {
  res.send(err.message);
}

export interface BSMiddlewareSetOptions extends BSPhantomOptions {
  metadata_cache?: any;
  mongoUrl?: string;
  downloader?: Downloader;
  // TODO
}

/**
 * Instantiates the BigSemanticsService and returns the middleware functions.
 * @param {Object} options
 * @returns {Promise<MiddlewareSet>}
 */
export function create(options: BSMiddlewareSetOptions): Promise<MiddlewareSet> {
  options.downloader = new RequestDownloader();

  let cacheSettings = options.metadata_cache;

  var bs = new BSPhantom();
  bs.load(options);
  return bs.getRepository().then(repo => {
    let cache = new MetadataCache({
      repoMan: bs.getRepoMan(),
      mmdRepo: repo,
      mongo: {
        url: options.mongoUrl,
        collection: cacheSettings.cache_collection
      }
    });
    cache.connect().catch(err => {
      logger.fatal({ err: err }, "Could not connect to cache");
    });

    logger.info("BSPhantom ready");

    return Promise.resolve({
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

      errorHandler: errorHandler,
    });
  });
}
