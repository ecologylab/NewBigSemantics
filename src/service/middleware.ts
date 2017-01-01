/**
 * express.RequestHandler for handling BigSemantics service requests.
 */

import * as Promise from 'bluebird';
import * as request from 'request';
import * as express from 'express';
import * as simpl from 'simpl.js';
import { MetaMetadata, BSResult } from '../core/types';
import * as config from '../utils/config';
import { ServiceOptions } from './options';
import { taskMon, logger } from './logging';
import { MetadataCache, DummyMetadataCache } from './metadataCache';
import MongoMetadataCache from './mongoMetadataCache';
import BSPhantom, { BSPhantomOptions } from './bsPhantom';
import Task from './task';

const serviceOptions = config.getOrFail('service', logger) as ServiceOptions;

/**
 *
 */
export interface Request extends express.Request {
  task?: Task;

  mmd?: {
    byName?: string;
    byUrl?: string;
  }

  page?: number;

  taskId?: string;
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

/**
 * @param {Request} req
 * @param {Task} task
 */
function copyParameters(req: Request, task: Task): void {
  // include in task, for viewing in the dashboard
  task.reqIp = req.ip;
  task.appId = req.query.aid;
  task.appVer = req.query.av;
}

/**
 * @param {Request} req
 * @param {express.Response} res
 * @param {BSResult} data
 * @param {string} format
 */
function sendResponse(req: Request, res: express.Response, data: BSResult, format: string): void {
  if (format === 'jsonp') {
    let callback = req.query.callback || null;
    res.contentType("application/javascript");
    res.send(callback + "(" + simpl.serialize(data) + ")");
  } else if (format === 'json'){
    res.contentType("application/json");
    res.send(simpl.serialize(data));
  } else {
    logger.error(new Error("Format not supported: " + format));
    res.sendStatus(500);
  }
}

/**
 * @param {BSPhantom} bs
 * @param {MetadataCache} cache
 * @param {string} format
 * @return {Middleware}
 */
function metadataFactory(bs: BSPhantom, cache: MetadataCache, format?: string): Middleware {
  return (req, res, next) => {
    if (!req.query.url && !req.query.uri) {
      throw new Error("Missing required query 'url'");
    }

    let url = req.query.url || req.query.uri;
    req.task = new Task(req.originalUrl);
    copyParameters(req, req.task);
    req.task.log("task initiated");

    let response: BSResult = {};

    // readThrough function that cache will use if Metadata not found
    let readThrough = (url: string) => {
      return bs.loadMetadata(url, {
        task: req.task,
        includeMmdInResult: true,
      });
    };
    cache.get(url, readThrough).then(result => {
      if (result && result.metadata) {
        // task.dpoolTasks = result.metadata.dpoolTasks;
        // delete result.metadata.dpoolTasks;
        req.task.log("task completed successfully");
        response.metadata = result.metadata;
        sendResponse(req, res, response, format);
        logger.info(req.task, "metadata extraction task succeeded");
      }
    }).catch(err => {
      req.task.log("task terminated", err);
      logger.error({ err: err, task: req.task }, "metadata extraction task failed");
      return next(err);
    });
  };
}

/**
 * @param {BSPhantom} bs
 * @param {string} format
 * @return {Middleware}
 */
function repositoryFactory(bs: BSPhantom, format: string): Middleware {
  return (req, res, next) => {
    req.task = new Task(req.originalUrl);
    copyParameters(req, req.task);
    req.task.log("task initiated");

    bs.getSerializedRepository().then(serializedRepo => {
      if (format === 'json') {
        res.contentType('application/json');
        res.send("{repository:" + serializedRepo + "}");
        req.task.log("task completed successfully");
        logger.info(req.task, "mmdrepository task succeeded");
      } else if (format === 'jsonp') {
        let callback = req.query.callback || 'null';
        res.contentType('application/javascript');
        res.send(callback + "({repository:" + serializedRepo + "})");
        req.task.log("task completed successfully");
        logger.info(req.task, "mmdrepository task succeeded");
      } else {
        next(new Error("Unsupported format: " + format));
      }
    });
  };
}

/**
 * @param {BSPhantom} bs
 * @param {string} format
 * @return {Middleware}
 */
function wrapperFactory(bs: BSPhantom, format?: string): Middleware {
  return (req, res, next) => {
    req.mmd = {};
    req.mmd.byName = req.query.name;
    req.mmd.byUrl = req.query.url || req.query.uri;

    let task = new Task(req.originalUrl);
    copyParameters(req, task);
    task.log("task initiated");

    let response: BSResult = {};

    let promisedResult: Promise<MetaMetadata> =  null;
    if (req.mmd.byName) {
      task.log("mmd requested by name", req.mmd.byName);
      promisedResult = bs.loadMmd(req.mmd.byName);
    } else if (req.mmd.byUrl) {
      task.log("mmd requested by url", req.mmd.byUrl);
      promisedResult = bs.selectMmd(req.mmd.byUrl);
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
        logger.error({ err: err, task: task }, "meta-metadata task failed");
        next(new Error("The requested Meta-Metadata could not be found."));
      });
    }
  }
}

/**
 * @return {Middleware}
 */
function taskListFactory(): Middleware {
  return (req, res, next) => {
    req.page = parseInt(req.query.page) || 0;

    // TODO paging!

    let response = {
      tasks: taskMon.getLast(50),
      numTasks: taskMon.size,
      successes: taskMon.stats.successes,
      warnings: taskMon.stats.warnings,
      failures: taskMon.stats.failures
    };
    res.send(response);
  };
}

/**
 * @return {Middleware}
 */
function taskDetailFactory(): Middleware {
  return (req, res, next) => {
    if (!req.query.id) {
      throw new Error("Missing required query 'id'");
    }
    req.taskId = req.query.id;
    let task = taskMon.filter(log => log.id === req.taskId)[0];
    res.json(task);
  };
}

/**
 * @param {BSPhantom} bs
 * @return {Middleware}
 */
function agentsInfoFactory(bs: BSPhantom): Middleware {
  return (req, res, next) => {
    let agents = bs.getMaster().agentsInfo();
    res.json({ agents: agents });
  };
}

/**
 * Retrieves the downloader worker information from the dpool.
 * Necessary because can't access different port from web page.
 * @return {Middleware}
 */
function downloadersInfoFactory(): Middleware {
  return (req, res, next) => {
    let workersUrl = `http://${serviceOptions.dpoolService.host}:${serviceOptions.dpoolService.port}/workers.json`;
    request(workersUrl, null, (err, resp, body) => {
      if(!err && resp.statusCode == 200) {
        res.contentType("application/json");
        res.send(body);
      } else {
        logger.error(err);
        res.sendStatus(500);
      }
    });
  };
}

/**
 * Necessary because express will not print message in production environment.
 * @param {any} err [description]
 * @param {Request} req [description]
 * @param {Response} res [description]
 * @param {NextFunction} next [description]
 */
let errorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  logger.error({ err: err, url: req.originalUrl, task: req['task'] });
  res.send(err.message);
}

/**
 * Instantiates the BigSemanticsService and returns the middleware functions.
 * @param {BSPhantomOptions} options
 * @returns {Promise<MiddlewareSet>}
 */
export function create(options: BSPhantomOptions): Promise<MiddlewareSet> {
  let bs = new BSPhantom();
  bs.load(options);

  return bs.onReadyP().then(() => {
    logger.info("BSPhantom ready");

    let cache: MetadataCache = null;
    if (serviceOptions.metadataCache) {
      if (serviceOptions.metadataCache.mongo) {
        cache = new MongoMetadataCache({
          repoMan: bs.getRepoMan(),
          mongo: {
            url: serviceOptions.metadataCache.mongo.url,
            collection: serviceOptions.metadataCache.mongo.collection,
          },
        });
      }
    } else {
      cache = new DummyMetadataCache();
    }

    return cache.connect().then(() => {
      let result: MiddlewareSet = {
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
      };
      return result;
    }).catch(err => {
      logger.fatal({ err: err }, "Could not connect to cache");
    });
  });
}
