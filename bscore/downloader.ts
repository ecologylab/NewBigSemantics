// Downloader

/// <reference path='../typings/tsd.d.ts' />

import * as request from 'request';

import * as bigsemantics from '../bigsemantics/bsjsCore/bstypes.d.ts';
import { ParsedURL } from '../bigsemantics/bsjsCore/ParsedURL.d.ts';
import { IDownloader } from '../bigsemantics/bsjsCore/Downloader.d.ts';

export class BaseDownloader implements IDownloader {

  static parseContentType(resp: bigsemantics.Response, contentTypeHeader: string) {
    var matches = contentTypeHeader.match(/([^;]+)(;\s*charset=(.*))?/);
    if (matches) {
      resp.contentType = matches[1];
      resp.charset = matches[3];
    }
  }

  static addOtherLocation(resp: bigsemantics.Response, otherLocation: string): boolean {
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
    var purl = new ParsedURL(location);
    var result: bigsemantics.Response = { location: location, code: 0 };

    var rOpts: any = {
      method: 'GET',
      url: location,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml,application/json,*/*',
        'Host': purl.host,
      }
    };
    if (options && options.userAgent) {
      rOpts.headers['User-Agent'] = options.userAgent;
    }
    var r = request(rOpts, function(err, resp, body) {
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
