/**
 * Middleware related utilities.
 */

import { Request } from 'express';

/**
 * @param {Request} req
 * @param {string|string[]} name
 * @param {RegExp} pattern
 * @return {string}
 */
export function validQuery(
  req: Request,
  name: string | string[],
  pattern: RegExp = /.+/
): 'valid' | 'missing' | 'invalid' {
  if (name instanceof Array) {
    for (let n of name) {
      switch (validQuery(req, n, pattern)) {
        case 'valid': return 'valid';
        case 'invalid': return 'invalid';
      }
    }
    return 'missing';
  }

  let val = req.query[name];
  if (!val) return 'missing';
  if (!val.match(pattern)) return 'invalid';
}

/**
 * @param {Request} req
 * @param {string} name
 * @param {RegExp} pattern
 */
export function validateQuery(
  req: Request,
  name: string | string[],
  pattern: RegExp = /.+/
): void {
  switch (validQuery(req, name, pattern)) {
    case 'missing': throw new Error("Missing required query ''" + name + "'");
    case 'invalid': throw new Error("Invalid value for query '" + name + "'");
  }
}
