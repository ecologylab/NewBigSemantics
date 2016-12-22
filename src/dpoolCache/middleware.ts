/**
 * Minio-based middleware.
 */

import { RequestHandler } from 'express';
import * as request from 'request';
import * as Minio from 'minio';
import { base32enc } from '../utils/codec';
import * as config from '../utils/config';
import { DPoolCacheOptions } from './options';
import logger from './logging';
import Task from './task';

const dpoolCacheOptions = config.getOrFail('dpool-cache', logger) as DPoolCacheOptions;

/**
 * TODO support download also
 */
export interface MiddlewareSet {
  proxy: RequestHandler;
}

/**
 * @param {Minio} mc
 * @return {RequestHandler}
 */
function proxyFactory(mc: Minio): RequestHandler {
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

        let reqUrl = `http://${dpoolCacheOptions.dpool_service.host}:${dpoolCacheOptions.dpool_service.port}/proxy?url=` + encodeURIComponent(url);
        request(reqUrl, (err, resp, body) => {
          if (err) {
            task.log("Error downloading from DPool", err);
            logger.error({ err: err, task: task }, "Failed to download from DPool");
            res.status(500);
            return;
          }

          res.send(body);

          task.log("Downloaded from DPool, storing in cache");
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

/**
 * @param {MiddlewareSet} callback
 * @return {[type]}
 */
export function create(): Promise<MiddlewareSet> {
  return new Promise<MiddlewareSet>((resolve, reject) => {
    let mc = new Minio({
      endPoint: dpoolCacheOptions.minio.endpoint,
      port: dpoolCacheOptions.minio.port,
      accessKey: dpoolCacheOptions.minio.access_key,
      secretKey: dpoolCacheOptions.minio.secret_key,
      secure: dpoolCacheOptions.minio.secure || false
    });

    let result = {
      proxy: proxyFactory(mc),
    };

    mc.bucketExists("cache", (err) => {
      if (!err) {
        resolve(result);
        return;
      }

      if (err.code != "NoSuchBucket") {
        logger.error(err, "Could not check if cache bucket exists");
      }

      mc.makeBucket("cache", "us-east-1", (err) => {
        if (!err) {
          resolve(result);
          return;
        }

        logger.error(err, "Error creating cache bucket");
        reject(err);
      });
    });
  });
}
