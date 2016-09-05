// Entry point for BigSemanticsService

import * as express from 'express';
import * as bsservice from './middleware';
import * as dashboard from '../dashboard/middleware';

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

  bsRouter.use("/tasks.json", res.tasksJson);
  bsRouter.use("/task.json", res.taskJson);
  
  bsRouter.use("/agents.json", res.agentsInfoJson);
  bsRouter.use("/downloaders.json", res.downloadersInfoJson);

  bsRouter.use(res.errorHandler);
});

dashboard.create((err, res) => {
  if(err) {
    console.error(err);
    return;
  }
 
  bsRouter.use("/dashboard", res.index);
});

app.use("/BigSemanticsService", bsRouter);
app.listen(PORT);
console.log("Service running on port " + PORT);
