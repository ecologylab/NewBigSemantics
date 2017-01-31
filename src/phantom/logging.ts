/**
 * Logging for phantom controlling module.
 */

import * as bunyan from 'bunyan';

export let logger = bunyan.createLogger({
  name: 'phantom-master-log',
  streams: [
    {
      level: 'info',
      type: 'rotating-file',
      path: 'phantom-master.log',
      period: '1d',
      count: 30,
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
