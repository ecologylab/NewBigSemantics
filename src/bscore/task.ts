import { Log } from '../utils/log';


export interface Task {
  id: string;

  url: string;
  userAgent: string;
  msPerAttempt: number;
  maxAttempts: number;

  //response?: HttpResponse;

  logs?: Array<Log>;

  // possible states:
  // - ready: ready to be dispatched to a worker.
  // - dispatched: dispatched to a worker; ongoing.
  // - finished: successfully done, and reported.
  // - terminated: unsuccessfully stopped after attempt(s), and reported.
  state?: string;

  attempts?: number;

  callback?: (error: Error, task: Task)=>void;
}