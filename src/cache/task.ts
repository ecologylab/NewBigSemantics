import Log from '../utils/log';
import { base32enc, sha256 } from '../utils/codec';
import * as dpool from '../dpool/types';

export interface Task {
  id: string;
  url: string;

  logs?: Log[];
}

export class Task {
  constructor(url: string) {
    this.id = base32enc(sha256(Date.now() + url)).substr(0, 10);
    this.url = url;
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