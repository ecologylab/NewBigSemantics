// A HTTP response parser.

import * as nodeUrl from 'url';
import { HttpHeader, HttpResponse as BSHttpResponse } from '../core/types';

/**
 * A HTTP response.
 */
export interface HttpResponse extends BSHttpResponse {
  location: string;
  otherLocations?: string[];

  code: number;
  message?: string;
  headers?: HttpHeader[];
  contentType?: string;
  charset?: string;

  entity?: Document | Object;
  xml?: Object;
  text?: string;

  raw?: Buffer;
  content?: string;
}

/**
 * [parseHttpResp description]
 * @param {string} url [description]
 * @param {Buffer} raw [description]
 * @return {HttpResponse} [description]
 */
export function parseHttpResp(url: string, raw: Buffer): HttpResponse {
  var otherUrls: string[] = [];

  var code: number;
  var message: string;
  var hdrs: HttpHeader[];

  var p = 0;
  while (true) {
    var q = raw.indexOf('\r\n\r\n', p);
    if (q < 0) {
      break;
    }

    var text = raw.toString('utf8', p, q);
    p = q + 4;
    var lines = text.split('\r\n');

    // read status
    var m1 = lines[0].match(/^HTTP\/\d\.\d\s+(\d+)\s+(.*)/);
    if (!m1) {
      throw new Error("Invalid status line: " + lines[0]);
    }
    code = Number(m1[1]);
    message = m1[2];

    // other headers
    hdrs = [];
    for (var i = 1; i < lines.length; ++i) {
      var m2 = lines[i].match(/^([^:]+):\s*(.+)/);
      if (!m2) {
        throw new Error("Invalid header line: " + lines[i]);
      }
      hdrs.push({ name: m2[1], value: m2[2] });
    }

    if (code < 300 || code >= 400) {
      break;
    }

    // deal with redirections
    otherUrls.push(url);
    var prevUrl = url;
    var foundRedirectLocation = hdrs.some((hdr) => {
      if (hdr.name === 'Location' || hdr.name === 'location') {
        url = hdr.value;
        if (!url.match(/^\w+:\/\/.+/)) {
          url = nodeUrl.resolve(prevUrl, url);
        }
        return true;
      }
      return false;
    });
    if (!foundRedirectLocation) {
      throw new Error("Redirect w/o Location: " + hdrs);
    }
  }

  var result: HttpResponse = {
    location: url,
    code: code,
    message: message,
    headers: hdrs,
  };
  result.raw = raw.slice(p);
  if (otherUrls.length > 0) {
    result.otherLocations = otherUrls;
  }
  return result;
}

export default parseHttpResp;
