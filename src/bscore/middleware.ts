import * as express from 'express';
import * as LRU from 'lru-cache';

import { BaseDownloader } from './downloader';
import BSPhantom from './bscore';
import logger from './logging';
import { Task, newTask, taskLog } from './task';

export interface Middleware {
    (req: express.Request, resp: express.Response, next: express.NextFunction): void;
}

export interface MiddlewareSet {
    metadata: Middleware;
}

function metadataFactory(bs: BSPhantom, tasks: LRU.Cache<Task>): Middleware {
    var result: Middleware = function (req, res, next) {
        var url = req.query.url;

        if (url) {
            let task = newTask(url);

            taskLog(task, "task initiated");
            bs.loadMetadata(url, {}, (err, result) => {
                if (err) {
                    taskLog(task, "task terminated", { err: err });
                    logger.error("task failed", task);
                }

                if (result.metadata) {
                    taskLog(task, "task completed successfully");
                    res.send(JSON.stringify(result.metadata));

                    logger.info("successful task", task);
                }
            });
        } else {
            // (?) Next vs. res.status(400).send
            //res.status(400).send("Parameter 'url' required");
            next(new Error("Parameter 'url' is required."));
        }
    };

    return result;
}

export function create(callback: (err: Error, result: MiddlewareSet) => void): void {
    var RepoSource = {
        url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
    };

    var options = {
        downloader: new BaseDownloader()
    };

    var bs = new BSPhantom(RepoSource, options);

    var tasks = LRU<Task>({
        max: 10000
    });

    bs.onReady((err, bs) => {
        if (err) {
            logger.error({ err: err }, "error starting BSPhantom");
            callback(err, null);
        } else {
            logger.info("BSPhantom ready");
            callback(null, {
                metadata: metadataFactory(bs, tasks),
            });
        }
    });
}