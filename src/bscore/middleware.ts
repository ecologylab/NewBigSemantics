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
}

interface Response {
    repository?: any;
    metadata?: any;
    aid?: string;
    uid?: string;
    sid?: string;
    rid?: string;
}

function getResponse(req: express.Request, resp: Response, format?: string): string {
    if(format == "jsonp") {
        resp.aid = req.query.aid;
        resp.uid = req.query.uid;
        resp.sid = req.query.sid;
        resp.rid = req.query.rid;

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
                    logger.error(task, "task failed");
                }

                if (result.metadata) {
                    task.log("task completed successfully");

                    var response: Response = { 
                        metadata: result.metadata
                    };

                    res.header("Content-Type", "application/json");
                    res.send(getResponse(req, response, format));
                    
                    logger.info(task, "successful task");
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

function repositoryFactory(bs: BSPhantom, format?: string): Middleware {
    var result: Middleware = function (req, res, next) {
        var response = {
            repository: bs.getRepo()["meta_metadata_repository"],
        };

        res.header("Content-Type", "application/json");
        res.send(getResponse(req, response, format));
    }
    
    return result;
}

function wrapperFactory(bs: BSPhantom, format?: string): Middleware {
    var result: Middleware = function (req, res, next) {
        var name = req.query.name;
        var url = req.query.url || req.query.uri;

        if(name) {
            bs.loadMmd(name, {}, mmdCallback);
        } else if(url) {
            bs.selectMmd(url, {}, mmdCallback);
        } else {
            next(new Error("'url' or 'name' parameter required."));
        }

        function mmdCallback(err, result) {
            var response = {
                wrapper: result["meta_metadata"]
            };

            res.header("Content-Type", "application/json");
            res.send(getResponse(req, response, format));
        }
    }
    
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
                wrapperJsonp: wrapperFactory(bs, "jsonp")
            });
        }
    });
}