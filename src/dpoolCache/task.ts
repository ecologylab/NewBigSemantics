/**
 * A caching task.
 */

import * as logging from '../utils/logging';
import { base32enc, sha256 } from '../utils/codec';

/**
 *
 */
export default class Task extends logging.Task {
  id: string;
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    this.id = base32enc(sha256(Date.now() + url)).substr(0, 10);
  }
}
