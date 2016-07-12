// Entry point for BigSemanticsService

import * as express from 'express';
import * as bsservice from './middleware';

const PORT = process.env.BS_SERVICE_PORT || 8000;

var app = express();
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

  app.use("/BigSemanticsService", bsRouter);
});

app.listen(PORT);
console.log("Service running on port " + PORT);
