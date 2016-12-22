/**
 * Entry point for BigSemanticsService.
 */

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as express from 'express';
import * as compression from 'compression';
import * as config from '../utils/config';
import { ServiceOptions } from './options';
import logger from './logging';

import * as middleware from './middleware';

const serviceOptions = config.getOrFail("service", logger) as ServiceOptions;

middleware.create({
  appId: 'bigsemantics-service',
  appVer: '3.0.2',

  repositoryUrl: serviceOptions.repository_url,
  serviceBase: serviceOptions.service_base,

  cacheRepoFor: serviceOptions.cache_repo_for,
}).then(res => {
  var bsRouter = express.Router();

  bsRouter.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  bsRouter.use(compression());

  bsRouter.use("/metadata.json", res.metadataJson);
  bsRouter.use("/metadata.jsonp", res.metadataJsonp);

  bsRouter.use("/wrapper.json", res.wrapperJson);
  bsRouter.use("/wrapper.jsonp", res.wrapperJsonp);
  bsRouter.use("/mmd.json", res.wrapperJson);
  bsRouter.use("/mmd.jsonp", res.wrapperJsonp);

  bsRouter.use("/repository.json", res.repositoryJson);
  bsRouter.use("/repository.jsonp", res.repositoryJsonp);
  bsRouter.use("/mmdrepository.json", res.repositoryJson);
  bsRouter.use("/mmdrepository.jsonp", res.repositoryJsonp);

  bsRouter.use("/tasks.json", res.tasksJson);
  bsRouter.use("/task.json", res.taskJson);

  bsRouter.use("/agents.json", res.agentsInfoJson);
  bsRouter.use("/downloaders.json", res.downloadersInfoJson);

  bsRouter.use(res.errorHandler);

  var app = express();
  app.use("/BigSemanticsService", bsRouter);

  var httpServer = http.createServer(app);
  httpServer.listen(serviceOptions.port);
  console.log("BigSemantics Service running on port " + serviceOptions.port);

  if (serviceOptions.use_https) {
    var options = {
      passphrase: serviceOptions.passphrase,
      pfx: fs.readFileSync(serviceOptions.pfx_path),
    };
    var httpsServer = https.createServer(options, app);
    httpsServer.listen(serviceOptions.secure_port);
    console.log("BigSemantics Service running on secure port " + serviceOptions.secure_port);
  }
}).catch(err => {
  console.error(err);
});
