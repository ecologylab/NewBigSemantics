// Type definitions, for TypeScript.

/// <reference path="../typings/index.d.ts" />

export interface HttpHeader {
  name: string;
  value: string;
}

export interface HttpResponse {
  url: string;
  otherUrls?: Array<string>;
  code: number;
  message: string;
  headers: Array<HttpHeader>;
  raw?: Buffer;
  content?: string;
}

export interface Log {
  datetime: Date;
  name: string;
  args?: any;
}

export interface Task {
  id: string;

  url: string;
  userAgent: string;
  msPerAttempt: number;
  maxAttempts: number;

  response?: HttpResponse;

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

export interface Worker {
  id: string;

  host: string;
  port: number;
  user: string;
  identity: string;

  // possible states:
  // - ready
  // - busy
  // - faulty: too many errors
  // - unresponsive
  state?: string;

  nextAccess?: { [domain: string]: Date };
}

export interface DomainInterval {
  domain: string;

  // the minimum interval for accessing this domain, in millisecond.
  min: number;
}
