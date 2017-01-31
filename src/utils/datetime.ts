/**
 * Date / Time related utilities.
 */

/**
 * Parse duration strings such as '5d', '1d12h', and '5d12h30m' into the number
 * of milliseconds.
 *
 * @param {string} duration
 * @param {string} defaultUnit
 * @return {number}
 */
export function parseDuration(duration: string, defaultUnit: string = 's'): number {
  let totalMs = 0;

  let match = duration.match(/((\d+)d)?((\d+)h)?((\d+)m)?((\d+)s)?/i);
  if (match) {
    let d = match[2] ? Number(match[2]) : 0;
    let h = match[4] ? Number(match[4]) : 0;
    let m = match[6] ? Number(match[6]) : 0;
    let s = match[8] ? Number(match[8]) : 0;
    totalMs = d*86400000 + h*3600000 + m*60000 + s*1000;
  } else {
    match = duration.match(/\d+/);
    if (match) {
      let defaultUnitDuration = {
        d: 86400000,
        h: 3600000,
        m: 60000,
        s: 1000,
      }[defaultUnit] || 1000;
      totalMs = Number(duration) * defaultUnitDuration;
    } else {
      throw new Error("Invalid duration: " + duration);
    }
  }

  return totalMs;
}
