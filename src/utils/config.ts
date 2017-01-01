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
// It's better to load configs as later as you can.
//
// Usage:
//
// import * as config from 'config';
// // in the middle of your code:
// let itemVal = config.get('my-component').myConfigItemName;

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as JSON5 from 'json5';
import * as yargs from 'yargs';
import { mergeInto } from './object';

/**
 *
 */
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

/**
 * Use commandline arguments to disable loading customized config for
 * components:
 *
 *     --disable-config=<comp1>[,<comp2>,...,<compN>]
 *
 * or to disable for all components:
 *
 *     --disable-config-all
 *
 * This can be useful for example in testing.
 */
let disabled: { [name: string]: string } = {};
let globallyDisabled = false;

let argv = yargs
  .string('disable-config')
  .boolean('disable-config-all')
  .argv;
if (argv.disableConfigAll) {
  globallyDisabled = true;
}
if (argv.disableConfig) {
  for (let comp of argv.disableConfig.split(',')) {
    disabled[comp] = comp;
  }
}

/**
 * Disable loading customized config for specified component.
 *
 * If component name omitted, disable for all components.
 *
 * @param {string} componentName
 */
export function disable(componentName?: string): void {
  if (componentName) {
    disabled[componentName] = componentName;
  } else {
    globallyDisabled = true;
  }
}

let cached: { [name: string]: Object } = {};

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
    mergeInto(config, obj);

    if (globallyDisabled || componentName in disabled) {
      break;
    }

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
    process.exit(255);
  }
}
