import * as express from 'express';
import * as path from 'path';
import { logs } from '../bscore/logging';

export interface Middleware {
  (req: express.Request, resp: express.Response, next: express.NextFunction): void;
}

export interface MiddlewareSet {
  index: Middleware;
}

export function create(callback: (err: Error, result: MiddlewareSet) => void): void {
  callback(null, {
    index: express.static(__dirname) 
  });
}