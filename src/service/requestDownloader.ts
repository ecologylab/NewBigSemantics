/**
 *
 */

import * as Promise from 'bluebird';
import * as request from 'request';
import ParsedURL from '../core/ParsedURL';
import { HttpResponse } from '../core/types';
import { RequestOptions, BaseDownloader } from '../core/downloader';

/**
 *
 */
export class RequestDownloader extends BaseDownloader {

  static parseContentType(resp: HttpResponse, contentTypeHeader: string) {
    var matches = contentTypeHeader.match(/([^;]+)(;\s*charset=(.*))?/);
    if (matches) {
      resp.contentType = matches[1];
      resp.charset = matches[3];
    }
  }

  static addOtherLocation(resp: HttpResponse, otherLocation: string): boolean {
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

  protected doHttpGet(location: string | ParsedURL, options?: RequestOptions): Promise<HttpResponse> {
    return new Promise<HttpResponse>((resolve, reject) => {
      var purl = ParsedURL.get(location);
      var result: HttpResponse = { location: purl.toString(), code: 0 };

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
        if (err) { reject(err); return; }

        result.location = r['uri'].href;
        result.code = resp.statusCode;
        result.text = body;
        if (resp.headers['content-type']) {
          RequestDownloader.parseContentType(result, resp.headers['content-type']);
        }
        resolve(result);
      });
      // collect redirects:
      r.on('redirect', function() {
        RequestDownloader.addOtherLocation(result, r['uri'].href);
      });
    });
  }

}

export default RequestDownloader;
