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
// var conf = config.get('my-component');
// console.log("merged configuration, as an object: ", conf);

/// <reference path="../../typings/index.d.ts" />

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as JSON5 from 'json5';

function search(initDir: string, fileName: string): { file: string, dir: string } {
  var dir = path.resolve(initDir);

  while (dir != '/') {
    var configDir = path.join(dir, 'config');
    var configFile = path.join(configDir, fileName);
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

function mergeInto(dest: Object, src: Object): void {
  if (dest && src) {
    for (var key in src) {
      var vsrc = src[key];
      var vdest = dest[key];
      if (vsrc) {
        if (vdest) {
          if (typeof vdest === 'object' && !(vdest instanceof Array)
              && typeof vsrc === 'object' && !(vsrc instanceof Array)) {
            mergeInto(vdest, vsrc);
            continue;
          }
        }
        dest[key] = vsrc;
      }
    }
  }
}

export function get(componentName: string): Object | Error {
  var defaultConfigFileName = componentName + '-default.json5';
  var configFileName = componentName + '.json5';

  var config = {};

  var result = search(__dirname, defaultConfigFileName);
  if (result instanceof Error) return result;
  if (result == null) return new Error("Configuration not found for " + componentName);
  var file = result.file;
  var dir = result.dir;

  while (true) {
    var obj = {};
    try {
      obj = JSON5.parse(fs.readFileSync(file).toString());
    } catch (err) {
      return new Error("Failed to parse " + file);
    }
    mergeInto(config, obj);

    result = search(path.dirname(dir), componentName + '.json5');
    if (result === null) break;
    file = result.file;
    dir = result.dir;
  }

  return config;
}
