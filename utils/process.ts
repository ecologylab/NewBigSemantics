// Simple process related utilities.

/// <reference path="../typings/index.d.ts" />

import * as cp from 'child_process';

export function spawn(cmd: string,
                      args: Array<string>,
                      options: any,
                      callback: (err: Error, result: any)=>void): void {
  options = options || {};
  options.stdio = options.stdio || [ 'ignore', 'pipe', 'pipe' ];
  var p = cp.spawn(cmd, args, options);

  var finished = false;
  var error: Error = null;
  var stdout: Buffer = null;
  var stderr: Buffer = null;

  p.on('error', (err) => {
    if (!finished) {
      finished = true;
      error = err;
      p.disconnect();
      callback(error, null);
    }
  });
  p.on('close', (code) => {
    if (!finished) {
      finished = true;
      if (code != 0) {
        error = new Error("Non-zero return code: " + code);
      }
      callback(error, {
        code: code,
        stdout: stdout,
        stderr: stderr,
      });
    }
  });
  p.stdout.on('data', (data) => {
    if (!finished) {
      if (stdout === null) {
        stdout = data;
      } else {
        stdout = Buffer.concat([ stdout, data ]);
      }
    }
  });
  p.stderr.on('data', (data) => {
    if (!finished) {
      if (stderr === null) {
        stderr = data;
      } else {
        stderr = Buffer.concat([ stderr, data ]);
      }
    }
  });
}
