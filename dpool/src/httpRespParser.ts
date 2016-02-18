// A HTTP response parser.

/// <reference path="../typings/main.d.ts" />

import * as nodeUrl from 'url';
import { HttpHeader, HttpResponse } from './types';

export default function parseHttpResp(url: string, raw: Buffer): HttpResponse {
  var otherUrls = new Array<string>();

  var code: number;
  var message: string;
  var hdrs: Array<HttpHeader>;

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
    hdrs = new Array<HttpHeader>();
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
      if (hdr.name === 'Location') {
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
    url: url,
    code: code,
    message: message,
    headers: hdrs,
    raw: raw.slice(p),
  };
  if (otherUrls.length > 0) {
    result.otherUrls = otherUrls;
  }
  return result;
}

