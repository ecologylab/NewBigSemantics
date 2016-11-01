/// <reference path="./minio.d.ts" />

import { base32enc } from "../utils/codec";
import * as express from "express";
import * as Minio from "minio";
import * as request from "request";
import logger from "./logging";
import Task from "./task";

export interface Middleware {
  (req: express.Request, resp: express.Response, next: express.NextFunction);
}

export interface MiddlewareSet {
  retrieve: Middleware;
}

function retrievalFactory(mc: Minio, options: any): Middleware {
  return (req, res, next) => {
    let url = req.query.url;
    let hashedUrl = base32enc(url);
    let task = new Task(url);

    mc.getObject("cache", hashedUrl, (err, stream) => {
      // cache hit
      if (!err) {
        task.log("Cache hit");
        stream.pipe(res);
        logger.info(task, "Retrieval successful");
      } else {
        task.log("Cache miss");
        
        request(`http://localhost:${options.dpool.port}/proxy?url=${url}`, (err, resp, body) => {
          if (err) {
            task.log("Error downloading from DPool", err);
            logger.error(task, "Failed to download");
            res.status(500);
            return;
          }

          res.end(body);

          task.log("Downloaded, storing in cache");
          task.log("Content-Type", resp.headers["content-type"])
          mc.putObject("cache", hashedUrl, body, resp.headers["content-type"], (err, etag) => {
            if (err) {;
              task.log("Error caching downloaded object", err);
              logger.error(task, "Error caching object");
              return;
            }

            task.log("Cached successfully");
            logger.info(task, "Caching succesful");
          });
        });
      }
    });
  };
}

export function create(callback: (err: Error, result: MiddlewareSet) => void, options?: any) {
  options = options || {};

  if (!options.cache || !options.dpool) {
    logger.error(options, "Incomplete cache options");
  }

  let mc = new Minio({
    endPoint: options.cache.endpoint,
    port: options.cache.minio_port,
    accessKey: options.cache.accessKey,
    secretKey: options.cache.secretKey,
    secure: options.cache.secure || false
  });

  mc.bucketExists("cache", (err) => {
    if (err) {
      if (err.code != "NoSuchBucket") {
        logger.error(err, "Could not check if cache bucket exists");
      }

      mc.makeBucket("cache", "us-east-1", (err) => {
        if (err) {
          logger.error(err, "Error creating cache bucket");
        }
      });
    }
  });

  callback(null, {
    retrieve: retrievalFactory(mc, options)
  });
}