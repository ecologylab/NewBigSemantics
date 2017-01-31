/**
 * Object related utilities.
 */

export function deepClone(val: any): typeof val {
  let result: typeof val;
  if (val instanceof Array) {
    result = [];
    for (let i in val) {
      result[i] = deepClone(val[i]);
    }
  } else if (typeof val === 'object') {
    result = {};
    for (let key in val) {
      result[key] = deepClone(val[key]);
    }
  } else {
    result = val;
  }
  return result;
}

/**
 * Recursively merge fields in src into dest.
 *
 * @param {Object} dest
 * @param {Object} src
 */
export function mergeInto(dest: Object, src: Object): void {
  if (dest && src) {
    for (var key in src) {
      var vsrc = src[key];
      var vdest = dest[key];
      if (vsrc !== undefined && vsrc !== null) {
        if (vdest !== undefined && vdest !== null) {
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
