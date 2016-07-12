// Entry point for BigSemanticsService

import * as express from 'express';
import * as bsservice from './middleware';

const PORT = 8000;

var app = express();
bsservice.create((err, res) => {
  app.use("/metadata.json", res.metadataJson);
  app.use("/metadata.jsonp", res.metadataJsonp);

  app.use("/wrapper.json", res.wrapperJson);
  app.use("/wrapper.jsonp", res.wrapperJsonp);
  app.use("/mmd.json", res.wrapperJson);
  app.use("/mmd.jsonp", res.wrapperJsonp);

  app.use("/repository.json", res.repositoryJson);
  app.use("/repository.jsonp", res.repositoryJsonp);
  app.use("/mmdrepository.json", res.repositoryJson);
  app.use("/mmdrepository.jsonp", res.repositoryJsonp);
});

app.listen(PORT);
console.log("Service running on port " + PORT);