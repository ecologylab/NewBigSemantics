/**
 * A BigSemantics task.
 */

import * as logging from '../utils/logging';
import { base32enc, sha256 } from '../utils/codec';
import * as dpool from '../dpool/taskMan';

/**
 *
 */
export class Task extends logging.Task {
  id: string;

  url: string;

  // for viewing in dashboard
  reqIp?: string;
  appId?: string;
  appVer?: string;

  // states:
  // - ready: ready to be dispatched to a worker.
  // - dispatched: dispatched to a worker; ongoing.
  // - finished: successfully done, and reported.
  // - terminated: unsuccessfully stopped after attempt(s), and reported.
  state?: 'ready' | 'dispatched' | 'finished' | 'terminated';

  dpoolTasks?: dpool.Task[];

  stack?: string;

  constructor(url: string) {
    super();
    this.url = url;
    this.id = base32enc(sha256(Date.now() + url)).substr(0, 10);

    this.state = "ready";
  }
}

export default Task;
