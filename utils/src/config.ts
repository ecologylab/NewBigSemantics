// Simple configuration related utilities.

/// <reference path="../typings/main.d.ts" />

import { parseJson } from './json';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function searchConfig(filename: string): string|Error {
  var dir = __dirname;

  while (dir != '/') {
    var fp = path.join(dir, filename);
    if (fs.existsSync(fp)) {
      return fp;
    }
    dir = path.dirname(dir);
  }

  var hfilepath = path.join(os.homedir(), filename);
  if (fs.existsSync(hfilepath)) {
    return hfilepath;
  }

  return new Error("Failed to find " + filename);
}

export function loadConfig(filename: string): any {
  var filepath = searchConfig(filename);
  if (filepath instanceof Error) {
    return filepath;
  }

  try {
    var s = fs.readFileSync(filepath as string, 'utf8');
    var config = parseJson(s);
    return config;
  } catch (exception) {
    return new Error("Failed to load config, exception: " + exception);
  }
}

