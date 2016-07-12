import * as bunyan from 'bunyan';
import Task from './task';
import Log from '../utils/log';

export var logs = new bunyan.RingBuffer({ limit: 10000 });
export var logger = bunyan.createLogger({
  name: "NewBigSemantics",
  streams: [{
      stream: process.stdout
    }, {
      type: 'raw',
      stream: logs
    },
    {
      type: 'rotating-file',
      path: 'NewBigSemantics.log',
      period: '1d',
      count: 7
    },
  ]
});

export default logger;