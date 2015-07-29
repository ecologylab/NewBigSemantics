// Downloader

/// <reference path='typings/tsd.d.ts' />

import * as request from 'request';

export interface Response {
  location: string;
  otherLocations?: Array<string>;

  code: number;
  contentType?: string;
  charset?: string;

  entity?: Object;
  xml?: Object;
  text?: string;
}

export interface Callback {
  (error: string, resp: Response): void;
}

export interface IDownloader {
  httpGet(location: string, options: Object, callback: Callback): void;
}

export class BaseDownloader implements IDownloader {

  static parseContentType(resp: Response, contentTypeHeader: string) {
    var matches = contentTypeHeader.match(/([^;]+)(;\s*charset=(.*))?/);
    if (matches) {
      resp.contentType = matches[1];
      resp.charset = matches[3];
    }
  }

  static addOtherLocation(resp: Response, otherLocation: string): boolean {
    if (otherLocation && otherLocation.length > 0) {
      if (otherLocation != resp.location) {
        if (!resp.otherLocations) {
          resp.otherLocations = [];
        }
        if (resp.otherLocations.indexOf(otherLocation) < 0) {
          var prevLocation = resp.location;
          resp.location = otherLocation;
          resp.otherLocations.push(prevLocation);
          return true;
        }
      }
    }
    return false;
  }

  httpGet(location, options, callback) {
    var result: Response = { location: location, code: 0 };

    var r = request(location, function(err, resp, body) {
      if (err) { callback(err, null); return; }

      result.location = r['uri'].href;
      result.code = resp.statusCode;
      result.text = body;
      if (resp.headers['content-type']) {
        BaseDownloader.parseContentType(result, resp.headers['content-type']);
      }
      callback(null, result);
    });
    // collect redirects:
    r.on('redirect', function() {
      BaseDownloader.addOtherLocation(result, r['uri'].href);
    });
  }

}

