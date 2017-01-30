// Logging.

import * as bunyan from 'bunyan';
import * as logging from '../utils/logging';

export let taskMon = new logging.TaskMonitor(10000);
export var logger = bunyan.createLogger({
  name: 'dpool-log',
  streams: [
    {
      level: 'info',
      type: 'rotating-file',
      path: 'dpool.log',
      period: '1d',
      count: 30,
    }, 
    {
      type: 'raw',
      stream: taskMon
    },
    {
      level: 'info',
      stream: process.stdout,
    },
    {
      level: 'error',
      stream: process.stderr
    }
  ],
  serializers: bunyan.stdSerializers,
});

export default logger;
