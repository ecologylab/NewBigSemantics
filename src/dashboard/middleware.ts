import * as express from 'express';
import * as path from 'path';
import * as request from 'request';

export interface Middleware {
  (req: express.Request, resp: express.Response, next: express.NextFunction): void;
}

export interface MiddlewareSet {
  index: Middleware;
  generated: Middleware;

  bsTasks: Middleware;
  bsAgents: Middleware;
  dpoolTasks: Middleware;
  dpoolWorkers: Middleware;
}

let baseURL = "http://localhost:";
let bsTasksURL = "/BigSemanticsService/tasks.json";
let bsAgentsURL = "/BigSemanticsService/agents.json";
let dpoolWorkersURL = "/workers.json";
let dpoolTasksURL = "/workers.json";

function grabAndRespond(res: express.Response, port: number, url: string) {
  console.log(baseURL + port + url);
  request(baseURL + port + url, null, (err, resp, body) => {
      res.setHeader("Content-Type", "application/json");
      res.send(body);
      res.end();
  });
}

function getBSTasks(bsConfig: any): Middleware {
  let result: Middleware = (req, res, next) => {
    grabAndRespond(res, bsConfig.port, bsTasksURL);
  };

  return result;
}

function getBSAgents(bsConfig: any): Middleware {
  let result: Middleware = (req, res, next) => {
    grabAndRespond(res, bsConfig.port, bsAgentsURL);
  }

  return result;
}

function getDPoolTasks(dpoolConfig: any): Middleware {
  let result: Middleware = (req, res, next) => {
    grabAndRespond(res, dpoolConfig.port, dpoolTasksURL);
  }

  return result;
}

function getDPoolWorkers(dpoolConfig: any): Middleware {
  let result: Middleware = (req, res, next) => {
    grabAndRespond(res, dpoolConfig.port, dpoolWorkersURL);
  }

  return result;
}

export function create(bsConfig: any, dpoolConfig: any, callback: (err: Error, result: MiddlewareSet) => void): void {
  callback(null, {
    index: express.static(path.join(__dirname, "../../static/dashboard")),
    generated: express.static(path.join(__dirname, "../dashboard/public")),
    bsTasks: getBSTasks(bsConfig),
    bsAgents: getBSAgents(bsConfig),
    dpoolTasks: getDPoolTasks(dpoolConfig),
    dpoolWorkers: getDPoolWorkers(dpoolConfig)
  });
}
