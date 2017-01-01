// Logging.

import * as bunyan from 'bunyan';

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
