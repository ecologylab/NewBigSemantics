import * as express from 'express';
import * as path from 'path';

export interface Middleware {
  (req: express.Request, resp: express.Response, next: express.NextFunction): void;
}

export interface MiddlewareSet {
  index: Middleware;
}

export function create(callback: (err: Error, result: MiddlewareSet) => void): void {
  callback(null, {
    index: express.static(path.join(__dirname, "../../static/dashboard")) 
  });
}
