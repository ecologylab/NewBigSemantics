import Log from '../utils/log';
import { base32enc, sha256 } from '../utils/codec';

export interface Task {
  id: string;
  url: string;

  logs?: Array<Log>;

  // possible states:
  // - ready: ready to be dispatched to a worker.
  // - dispatched: dispatched to a worker; ongoing.
  // - finished: successfully done, and reported.
  // - terminated: unsuccessfully stopped after attempt(s), and reported.
  state?: string;
}

export class Task {
  constructor(url: string) {
    this.id = base32enc(sha256(Date.now() + url)).substr(0, 10);
    this.url = url;

    this.state = "ready";
  }

  log(name: string, args?: any) {
    if(!this.logs) {
      this.logs = [];
    }

    this.logs.push({
      datetime: new Date(),
      name: name,
      args: args
    });
  }
}

export default Task;