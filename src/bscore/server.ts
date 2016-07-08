// Entry point for BigSemanticsService

import * as express from 'express';
import * as bsservice from './middleware';

const PORT = 8000;

var app = express();
bsservice.create((err, res) => {
  app.use("/metadata", res.metadata);
});

app.listen(PORT);
console.log("Service running on port " + PORT);