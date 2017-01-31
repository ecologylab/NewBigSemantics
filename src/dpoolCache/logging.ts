/**
 * Logging objects for cache.
 */

import * as bunyan from 'bunyan';
import * as logging from '../utils/logging';

export let taskMon = new logging.TaskMonitor(10000);
export let logger = bunyan.createLogger({
  name: "dpool-cache-log",
  streams: [
    {
      stream: process.stderr
    },
    {
      type: 'raw',
      stream: taskMon
    },
    {
      type: 'rotating-file',
      path: 'dpool-cache.log',
      period: '1d',
      count: 30 
    },
  ]
});

export default logger;
