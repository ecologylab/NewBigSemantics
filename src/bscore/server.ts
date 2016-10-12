// Entry point for BigSemanticsService

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as express from 'express';
import * as compression from 'compression';

import logger from './logging';
import * as config from '../utils/config';
import * as bsservice from './middleware';

function loadConfigOrQuit(file: string): any {
  let conf = config.get(file);

  if (conf == null) {
    logger.fatal("Failed to load configurations - " + file);
  } else if (conf instanceof Error) {
    logger.fatal({ err: conf as Error }, "Error loading configurations");
  } else {
    logger.info("Configurations loaded: %s", conf);
    return conf;
  }

  process.exit(1);
}

let conf = loadConfigOrQuit("service");

// if we're using the dpool for proxying, we have to figure out the port
if(conf.proxy_url == "dpool") {
  let dpoolConf = loadConfigOrQuit("dpool");
  conf.proxy_url = "http://localhost:" + dpoolConf.port + "/proxy?url=";
}

var bsRouter = express.Router();
bsservice.create((err, res) => {
  if (err) {
    console.error(err);
    return;
  }

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
}, conf);

var app = express();
app.use(compression())

app.use("/BigSemanticsService", bsRouter);
var httpServer = http.createServer(app);
httpServer.listen(conf.port);

if (conf.use_https) {
  var options = {
    passphrase: conf.passphrase,
    pfx: fs.readFileSync(conf.pfx_path),
  };
  var httpsServer = https.createServer(options, app);
  httpsServer.listen(conf.secure_port);
}

console.log("BigSemantics Service running on port " + conf.port + (conf.use_https ? (" and " + conf.secure_port) : ""));
