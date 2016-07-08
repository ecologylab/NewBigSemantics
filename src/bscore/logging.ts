import * as bunyan from 'bunyan';
import Task from './task';
import Log from '../utils/log';

export var logger = bunyan.createLogger({
  name: "NewBigSemantics",
  streams: [{
    stream: process.stdout
  },
  {
    type: 'rotating-file',
    path: 'NewBigSemantics.log',
    period: '1d',
    count: 7
  }]
});

export default logger;
