// Simple configuration management tool.
//
// This tool assumes the following simple directory layout for both development
// and deployment:
//
//   /instance
//     /script
//     /log
//     /config
//       component1.json
//       component2.json
//     /project
//       /src
//       /config
//         component1-default.json
//         component2-default.json
//         component3-default.json
//       /build
//       /static
//
// Where instance is a folder containing everything about this particular
// running instance, and project is the source controlled repository for that
// project.
//
// With this layout, configurations are simply divided into two categories:
//   - Default configurations
//     - Required
//     - Each component can only have 1 default configuration file
//     - File name format: <component_name>-default.<format>
//   - Instance-specific configurations
//     - Optional
//     - Each component can have multiple configuration files
//     - File name format: <component_name>.<format>
//
// This simple tool helps you find default and instance-specific configurations,
// and merge them into one single configuration object for convenient use in
// code.
//
// Usage:
//
// import * as config from 'config';
// let conf = config.get('my-component');
// console.log("merged configuration, as an object: ", conf);

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as JSON5 from 'json5';

interface SearchResult {
  file: string;
  dir: string;
}

/**
 * @param {string} initDir
 * @param {string} fileName
 * @return {SearchResult}
 */
function search(initDir: string, fileName: string): SearchResult {
  let dir = path.resolve(initDir);

  while (dir != '/') {
    let configDir = path.join(dir, 'config');
    let configFile = path.join(configDir, fileName);
    if (fs.existsSync(configFile)) {
      return {
        file: configFile,
        dir: dir,
      };
    }
    dir = path.dirname(dir);
  }

  return null;
}

interface MapKey {
  (origKey: string): string;
}

/**
 * Merge src[key] into dest[destKey], where
 *     destKey = mapKey ? mapKey(key) : key.
 *
 * Special cases:
 * - If src or src[key] doesn't exist, do nothing.
 * - If dest doesn't exist but src[key] exists, create a new Object and return
 *   as the new dest.
 * - If src[key] and dest[destKey] both exist and are Arrays, concatenate them
 *   into one Array.
 * - If src[key] and dest[destKey] both exist and are Objects, recursively merge
 *   them.
 *
 * @param {Object} dest
 * @param {Object} src
 * @param {string} key
 * @param {MapKey} mapKey
 * @returns {Object}
 */
export function mergeFieldInto(dest: Object, src: Object, key: string, mapKey?: MapKey): typeof dest {
  let vsrc = src ? src[key] : undefined;
  let destKey = mapKey ? mapKey(key) : key;
  if (destKey) {
    let vdest = dest ? dest[destKey] : undefined;
    if (vsrc) {
      if (!dest) dest = {};
      if (vdest) {
        if (vdest instanceof Array && vsrc instanceof Array) {
          Array.prototype.push.apply(vdest, vsrc);
        } else if (vdest instanceof Object && vsrc instanceof Object) {
          mergeInto(vdest, vsrc, mapKey);
        }
        return dest;
      }
      dest[destKey] = vsrc;
    }
  }
  return dest;
}

/**
 * @param {Object} dest
 * @param {Object} src
 * @returns {Object}
 */
export function mergeInto(dest: Object, src: Object, mapKey?: MapKey): Object {
  if (src) {
    for (let key in src) {
      dest = mergeFieldInto(dest, src, key, mapKey);
    }
  }
  return dest;
}

let cached = {};

/**
 * @param {string} componentName without extension
 * @return {Object|Error}
 */
export function get(componentName: string): Object | Error {
  if (componentName in cached) return cached[componentName];

  let defaultConfigFileName = componentName + '-default.json5';
  let configFileName = componentName + '.json5';

  let config = {};

  let result = search(__dirname, defaultConfigFileName);
  if (result instanceof Error) return result;
  if (result == null) return new Error("Configuration not found for " + componentName);
  let file = result.file;
  let dir = result.dir;

  while (true) {
    let obj = {};
    try {
      obj = JSON5.parse(fs.readFileSync(file).toString());
    } catch (err) {
      return new Error("Failed to parse " + file);
    }
    config = mergeInto(config, obj);

    result = search(path.dirname(dir), componentName + '.json5');
    if (result === null) break;
    file = result.file;
    dir = result.dir;
  }

  cached[componentName] = config;
  return config;
}

/**
 * @param {string} componentName without extension
 * @return {Object}
 */
export function getOrThrow(componentName: string): Object {
  let conf = get(componentName);
  if (!conf) throw new Error("Error loading configs for " + componentName);
  if (conf instanceof Error) throw conf as Error;
  return conf;
}

interface Logger {
  fatal(error: Error, format?: any, ...params: any[]);
}

/**
 * @param {string} componentName without extension
 * @return {Object}
 */
export function getOrFail(componentName: string, logger?: Logger): Object {
  try {
    return getOrThrow(componentName);
  } catch (err) {
    if (logger) {
      logger.fatal(err, "Error loading configs for " + componentName);
    }
    throw err;
  }
}
