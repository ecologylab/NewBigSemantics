import Log from '../utils/log';
import { base32enc } from '../utils/codec';

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

export function newTask(url: string): Task {
  return {
    id: base32enc(Date.now() + url).substr(0, 10),
    url: url,

    logs: [],

    state: "ready"
  }
}

export function taskLog(task: Task, name: string, args?: any) {
  if(!task.logs) {
    task.logs = new Array<Log>();
  }

  task.logs.push({
    datetime: new Date(),
    name: name,
    args: args
  });
}

export default Task;