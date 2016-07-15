// Coding / decoding utilities.

/// <reference path="../../typings/index.d.ts" />

import * as crypto from 'crypto';

export function base32enc(s: string): string;
export function base32enc(buf: Buffer): string;
export function base32enc(x): string {
  var buf: Buffer;

  if (typeof x === 'string') {
    buf = new Buffer(x);
  } else {
    buf = x;
  }

  var q = buf.length % 5;

  var v = '0123456789abcdefghjkmnpqrstvwxyz';

  var result = '';
  for (var i = 0; i < buf.length; i += 5) {
    var a = [
      buf.readUInt8(i),
      (i+1 < buf.length) ? buf.readUInt8(i+1) : 0,
      (i+2 < buf.length) ? buf.readUInt8(i+2) : 0,
      (i+3 < buf.length) ? buf.readUInt8(i+3) : 0,
      (i+4 < buf.length) ? buf.readUInt8(i+4) : 0,
    ];
    var lastQuantum = i+4 >= buf.length;

    result += v[a[0] >> 3];
    result += v[((a[0] & 7) << 2) + (a[1] >> 6)];
    if (lastQuantum && q === 1) {
      result += '======';
      break;
    }
    result += v[(a[1] & 63) >> 1];
    result += v[((a[1] & 1) << 4) + (a[2] >> 4)];
    if (lastQuantum && q === 2) {
      result += '====';
      break;
    }
    result += v[((a[2] & 15) << 1) + (a[3] >> 7)];
    if (lastQuantum && q === 3) {
      result += '===';
      break;
    }
    result += v[(a[3] & 127) >> 2];
    result += v[((a[3] & 3) << 3) + (a[4] >> 5)];
    if (lastQuantum && q === 4) {
      result += '=';
      break;
    }
    result += v[a[4] & 31];
  }
  return result;
}

export function sha256(s: string): Buffer {
  return crypto.createHash('sha256').update(s).digest();
}
