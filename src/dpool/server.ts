// The web server

/// <reference path="../../typings/index.d.ts" />
/// <reference path="./xml.d.ts" />

import * as express from 'express';
import * as middleware from './middleware';

middleware.create((err, mws) => {
  if (err) {
    console.error("Cannot create middlware set!");
    return;
  }

  var app = express();
  app.get('/download', mws.validateParams, mws.download);
  app.get('/proxy', mws.validateParams, mws.proxy);
  app.get('/DownloaderPool/echo/get', mws.validateParams, mws.get);
  app.get('/DownloaderPool/page/download.json', mws.validateParams, mws.downloadJson);
  app.get('/DownloaderPool/page/download.xml', mws.validateParams, mws.downloadXml);
  var server = app.listen(3000, () => {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Web server listening at http://%s:%s", host, port);
  });
});
