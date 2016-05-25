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

export function nicePResult(pResult: any): any {
  var result: any = {};
  if (pResult.code) {
    result.code = pResult.code;
  }
  if (pResult.stdout && pResult.stdout instanceof Buffer) { 
    result.stdout = pResult.stdout.toString();
  }
  if (pResult.stderr && pResult.stderr instanceof Buffer) { 
    result.stderr = pResult.stderr.toString();
  }
  return result;
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
      level: 'info',
      stream: process.stderr,
    },
  ],
  serializers: bunyan.stdSerializers,
});

export default logger;

