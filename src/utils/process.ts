// Simple process related utilities.

import * as cp from 'child_process';
import * as Promise from 'bluebird';

/**
 *
 */
export interface SpawnResult {
  code?: number;
  signal?: string;
  stdout?: Buffer | string;
  stderr?: Buffer | string;

  cmd: string;
  args?: string[];
}

export class ExitError extends Error {
  result: SpawnResult;

  constructor(result: SpawnResult, message?: string) {
    super(message);
    this.result = result;
  }
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {cp.SpawnOptions} options
 * @return {Promise<SpawnResult>}
 */
export function spawn(cmd: string, args: string[] = [], options: cp.SpawnOptions = {}): Promise<SpawnResult> {
  return new Promise<SpawnResult>((resolve, reject) => {
    options.stdio = options.stdio || [ 'ignore', 'pipe', 'pipe' ];
    let p = cp.spawn(cmd, args, options);

    let finished = false;
    let stdout: Buffer = null;
    let stderr: Buffer = null;

    p.on('error', err => {
      finished = true;
      p.disconnect();
      reject(err);
    });

    p.on('close', (code, signal) => {
      finished = true;
      let result: SpawnResult = {
        code: code,
        signal: signal,
        cmd: cmd,
        args: args,
        stdout: stdout,
        stderr: stderr,
      }
      if (code !== 0) {
        reject(new ExitError(result, "Spawned process exited with error code"));
        return;
      }
      resolve(result);
    });

    p.stdout.on('data', (data: Buffer) => {
      if (finished) return;
      if (stdout) stdout = Buffer.concat([ stdout, data ]);
      else stdout = data;
    });

    p.stderr.on('data', (data: Buffer) => {
      if (finished) return;
      if (stderr) stderr = Buffer.concat([ stderr, data ]);
      else stderr = data;
    });
  });
}

/**
 * @param {SpawnResult} spawnResult
 * @return {NiceSpawnResult}
 */
export function niceSpawnResult(result: SpawnResult): SpawnResult {
  if (result.stdout instanceof Buffer) {
    result.stdout = result.stdout.toString();
  }
  if (result.stderr instanceof Buffer) {
    result.stderr = result.stderr.toString();
  }
  return result;
}
