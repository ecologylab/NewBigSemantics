/**
 *
 */

import * as http from "http";
import * as express from "express";
import * as compression from "compression";
import * as config from "../utils/config";
import { DPoolOptions } from '../dpool/options';
import { DPoolCacheOptions } from './options';
import logger from './logging';
import * as cache from "./middleware";

let dpoolCacheOptions = config.getOrFail("dpool-cache", logger) as DPoolCacheOptions;

let app = express();
app.use(compression());

cache.create().then(mws => {
  app.get("/proxy", mws.proxy);
}).catch(err => {
  logger.error(err);
});

let httpServer = http.createServer(app);
httpServer.listen(dpoolCacheOptions.port);
