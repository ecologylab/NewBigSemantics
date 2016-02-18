// Logging.

/// <reference path="../typings/main.d.ts" />

import * as bunyan from 'bunyan';
import { Log, Task } from './types';

export function taskLog(task: Task, name: string, args?: any) {
  if (!task.logs) {
    task.logs = new Array<Log>();
  }
  task.logs.push({
    datetime: new Date(),
    name: name,
    args: args,
  });
}

var logger = bunyan.createLogger({
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
      level: 'warn',
      stream: process.stderr,
    },
  ],
});

export default logger;

