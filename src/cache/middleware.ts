/// <reference path="./minio.d.ts" />

import { base32enc } from '../utils/codec';
import * as express from 'express';
import * as Minio from 'minio';
import * as request from 'request';

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

    mc.getObject("cache", hashedUrl, (err, stream) => {
      // cache hit
      if (!err) {
        stream.pipe(res);
      } else {
        request(`http://localhost:${options.dpool.port}/proxy?url=${url}`, (err, resp, body) => {
          if (err) {
            console.error("Error downloading from DPool: " + err);
            res.status(500);
            return;
          }

          res.end(body);

          mc.putObject("cache", hashedUrl, body, "text/html", (err, etag) => {
            if (err) {
              console.error("Error caching downloaded object: " + err);
              return;
            }

            console.log(`Cached ${url} successfully.`);
          });
        });
      }
    });
  };
}

export function create(callback: (err: Error, result: MiddlewareSet) => void, options?: any) {
  options = options || {};

  if (!options.cache || !options.dpool) {
    console.error("Incomplete cache options!");
    console.error("Cache Options: " + JSON.stringify(options.cache));
    console.error("DPool Options: " + JSON.stringify(options.dpool));
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
      if (err.code != "NoSuchBucket") console.error("Could not check if cache bucket exists!");

      mc.makeBucket("cache", "us-east-1", (err) => {
        if (err) console.error("Error creating cache bucket: " + err);
      });
    }
  });

  callback(null, {
    retrieve: retrievalFactory(mc, options)
  });
}