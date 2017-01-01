// The web server

/// <reference path="./xml.d.ts" />

import * as express from 'express';
import * as config from '../utils/config';
import { DPoolOptions } from './options';
import logger from './logging';
import create from './middleware';

let dpoolOptions = config.getOrFail('dpool', logger) as DPoolOptions;

create().then(mws => {
  var app = express();
  app.get('/download', mws.download);
  app.get('/proxy', mws.proxy);
  app.get('/workers', mws.workers);
  app.get('/workers.json', mws.workers);

  // FIXME remove the following routes -- they are merely for backward compatibility.
  app.get('/DownloaderPool/echo/get', mws.echo);
  app.get('/DownloaderPool/page/download.json', mws.downloadJson);
  app.get('/DownloaderPool/page/download.xml', mws.downloadXml);
  var server = app.listen(dpoolOptions.port, () => {
    var host = server.address().address;
    var port = server.address().port;
    console.log("DPool server listening at http://%s:%s", host, port);
  });
}).catch(err => {
  logger.fatal(err, "Cannot create middleware set!");
});
