// The PhantomJS master.

/// <reference path="../../typings/index.d.ts" />

import * as os from 'os';
import * as child_process from 'child_process';
import * as events from 'events';
import * as http from 'http';
import * as express from 'express';
import * as SocketIO from 'socket.io';
import * as path from 'path';

import * as config from '../utils/config';

var conf: any = config.get('service');

// Default port for Master's internal web / websocket server.
export const webPort = conf.phantom_master_port;

// Options for a Master.
export interface MasterOptions {
  numberOfInitialAgents?: number;
  defaultAgentOptions?: AgentOptions;
  masterPort?: number;
}

interface AgentDetails {
  pid: number,
  id: string,
  creationDate: Date,
  pagesOpened: number,
  tasks?: number,
  successfulTasks?: number,
  failedTasks?: number
}

// Master of multiple phantomjs processes and their agents.
// Runs the web and websocket servers.
//
// Can emit events:
//     socket[<agentId>].init
export class Master extends events.EventEmitter {

  private options: MasterOptions;

  private app: express.Express;
  private server: http.Server;
  private io: SocketIO.Server;

  private agents: { [id: string]: Agent } = {};
  private agentId = 1;

  constructor(options?: MasterOptions) {
    super();

    this.options = options || {};

    this.app = express();
    this.server = http.createServer(this.app);
    this.io = SocketIO(this.server);
    this.app.use('/', express.static(path.resolve(__dirname, 'static')));
    this.server.listen(this.options.masterPort || webPort);

    for (var i = 0; i < (this.options.numberOfInitialAgents || 1); ++i) {
      this.newAgent(null, null, this.options.defaultAgentOptions);
    }

    this.io.on('connection', socket => {
      socket.on('init', msg => {
        var agentId = msg.agentId;
        var agent = this.agents[agentId];
        if (agent) {
          this.emit('socket[' + agentId + '].init', socket);
        } else {
          var agentOptions: AgentOptions = {
            host: '' + msg.host,
            port: Number(msg.port),
            pactFile: '' + msg.pactFile,
            noNewProcess: true,
          };
          this.newAgent(agentId, Promise.resolve(socket), agentOptions);
        };
      });
    });
  }

  public agentsInfo(): AgentDetails[]  {
    var info: Array<AgentDetails> = [];

    for(var agentID of Object.keys(this.agents)) {
      var agent = this.agents[agentID];

      info.push({
        pid: agent.getPid(),
        id: agent.getId(),
        creationDate: agent.getCreationDate(),
        pagesOpened: agent.getPagesOpened()
      });
    }

    return info;
  }

  private newAgent(agentId: string,
                   promisedSocket?: Promise<SocketIO.Socket>,
                   agentOptions?: AgentOptions): Agent {
    var agentId = agentId || os.hostname() + '/a' + this.agentId++;
    if (!promisedSocket) {
      promisedSocket = new Promise<SocketIO.Socket>((resolve, reject) => {
        this.once('socket[' + agentId + '].init', socket => {
          resolve(socket);
        });
      });
    }
    var agent = new Agent(agentId, promisedSocket, agentOptions);
    this.agents[agentId] = agent;
    return agent;
  }

  randomAgent(): Agent {
    var ids = Object.keys(this.agents);
    var i = Math.floor(ids.length * Math.random());
    return this.agents[ids[i]];
  }

  shutdown(): Promise<boolean> {
    var agentShutdownPromises = [];
    for (var agentId in this.agents) {
      var p = this.agents[agentId].shutdown();
      agentShutdownPromises.push(p);
    }
    return Promise.all(agentShutdownPromises).then(() => {
      this.io.close();
      this.server.close();
      return true;
    });
  }

}

// Options for phantomjs agents.
export interface AgentOptions {
  host?: string;
  port?: number;
  pactFile?: string;
  noNewProcess?: boolean;
}

// Phantomjs agent. Holds a phantomjs instance (process), the socket for
// communication, and all open pages on this instance.
export class Agent extends events.EventEmitter {

  private id: string;
  private creationDate: Date;
  private options: AgentOptions;

  private process: child_process.ChildProcess;

  private socket: Promise<SocketIO.Socket>;

  private pages: { [id: string]: Page } = {};
  private pageId = 1;

  constructor(id: string,
              socket: Promise<SocketIO.Socket>,
              options?: AgentOptions) {
    super();

    this.id = id;
    this.options = options || {};
    this.creationDate = new Date();

    if (!this.options.noNewProcess) {
      var args = [
        this.options.pactFile || path.resolve(__dirname, 'pact.js'),
        this.id,
        this.options.host || 'localhost',
        '' + (this.options.port || webPort),
      ];
      this.process = child_process.spawn('phantomjs', args);
      this.process.stdout.on('data', data => {
        console.log('phantomjs.stdout: ', data.toString());
        // TODO logging
      });
      this.process.stderr.on('data', data => {
        console.error('phantomjs.stderr: ', data.toString());
        // TODO logging
      });
      this.process.on('error', err => {
        console.error("phantomjs error: ", err);
        // TODO logging
      });
      this.process.on('exit', (code, signal) => {
        console.error("phantomjs exited with code " + code);
        // TODO logging
      });
    }

    this.socket = socket.then(s => {
      s.on('response', msg => {
        this.emit('resp[' + msg.id + ']', msg);
      });

      s.on('console', msg => {
        this.pages[msg.id].newConsoleMessage(msg.text);
      });

      s.on('error', msg => {
        this.pages[msg.id].newErrorMessage(msg.text, msg.params.trace);
      });

      s.on('task', msg => {
        var task = JSON.parse(msg.text);
        this.pages[msg.id].newTask(task);
      });

      // TODO add more listeners on s, if any
      return s;
    });
  }

  getId(): string {
    return this.id;
  }

  getPid(): number {
    return this.process.pid;
  }

  getPagesOpened(): number {
    return this.pageId - 1;
  }

  getCreationDate(): Date {
    return this.creationDate;
  }

  createPage(): Page {
    var pageId = this.id + '/p' + this.pageId++;
    // the purpose of this promise is to make sure pages are created in order.
    var promisedSocket = this.socket.then(s => s);
    this.socket = promisedSocket;
    var page = new Page(pageId, this, promisedSocket);
    this.pages[pageId] = page;
    return page;
  }

  shutdown(): Promise<boolean> {
    return this.socket.then(s => {
      s.emit('exit');
      return true;
    });
  }

}

// A webpage. One can perform operations on it, such as open an URL or evaluate
// a function. It has then(), catch(), finally() to enable retrieving the result
// of most recent operation, handle errors, and cleaning up after use.
export class Page extends events.EventEmitter {

  private id: string;

  private agent: Agent;
  private socket: Promise<SocketIO.Socket>;
  private msgId = 1;

  private consoleCallback: (msg: string) => void;
  private errorCallback: (err: string, trace: string) => void;
  private taskCallback: (task: any) => void;

  // a promise for a future value which will be the result of most recent
  // operation on this webpage
  private promise: Promise<any>;

  constructor(id: string, agent: Agent, socket: Promise<SocketIO.Socket>) {
    super();

    this.id = id;

    this.agent = agent;
    this.socket = socket;
    this.promise = this.sendCmd('createPage', { pageId: this.id });
  }

  private sendCmd(method: string, params?: any): Promise<any> {
    return this.socket.then(s => {
      var msgId = this.id + '/m' + this.msgId++;
      params = params || {};
      params.pageId = this.id;
      s.emit('command', {
        id: msgId,
        method: method,
        params: params,
      });
      return new Promise((resolve, reject) => {
        this.agent.once('resp[' + msgId + ']', resp => {
          if (resp.error) {
            reject(resp.error);
            return;
          }
          resolve(resp.result);
        });
      });
    });
  }

  private chain(promiseFactory: ()=>Promise<any>): void {
    this.promise = this.promise.then(promiseFactory);
  }

  open(url: string, content?: string): Page {
    this.chain(() => {
      var params: { url: string, content?: string} = { url: url };
      if (content) {
        params.content = content;
        return this.sendCmd('setContent', params);
      } else {
        return this.sendCmd('open', params);
      }
    });
    return this;
  }

  newConsoleMessage(msg: string) {
    if (this.consoleCallback) {
      this.consoleCallback(msg);
    }
  }

  newErrorMessage(err: string, trace: string) {
    if (this.errorCallback) {
      this.errorCallback(err, trace);
    }
  }

  newTask(task: any) {
    if (this.taskCallback) {
      this.taskCallback(task);
    }
  }

  onConsole(callback: (msg: string) => void): Page {
    this.consoleCallback = callback;

    return this;
  }

  onError(callback: (msg: string, trace: string) => void): Page {
    this.errorCallback = callback;

    return this;
  }

  onTask(callback: (task: any) => void): Page {
    this.taskCallback = callback;

    return this;
  }

  setIgnoredSuffixes(suffixes: string[]): Page {
    this.chain(() => {
      var params = { suffixes: suffixes };
      return this.sendCmd('setIgnoredSuffixes', params);
    });
    return this;
  }

  setProxy(proxyURL: string): Page {
    this.chain(() => {
      var params = { proxyURL: proxyURL };
      return this.sendCmd('setProxy', params);
    });

    return this;
  }

  setProxyBlacklist(patterns: string[]): Page {
    this.chain(() => {
      var params = { patterns: patterns };
      return this.sendCmd('setProxyBlacklist', params);
    });

    return this;
  }

  setProxyWhitelist(patterns: string[]): Page {
    this.chain(() => {
      var params = { patterns: patterns };
      return this.sendCmd('setProxyWhitelist', params);
    });

    return this;
  }

  injectJs(files: string|string[]): Page {
    this.chain(() => {
      var params = { files: files };
      return this.sendCmd('injectJs', params);
    });
    return this;
  }

  evaluate(fn: Function, ...args: any[]): Page {
    this.chain(() => {
      var params = {
        func: fn.toString(),
        args: args,
      };
      return this.sendCmd('evaluate', params);
    });
    return this;
  }

  evaluateAsync(fn: Function, ...args: any[]): Page {
    this.chain(() => {
      var params = {
        func: fn.toString(),
        args: args,
      };
      return this.sendCmd('evaluateAsync', params);
    });
    return this;
  }

  close(): Page {
    this.chain(() => {
      return this.sendCmd('close', null);
    });
    return this;
  }

  then(callback: (result: any)=>void): Page {
    this.promise = this.promise.then(result => {
      callback(result);
      return result;
    });
    return this;
  }

  catch(callback: (err: Error)=>void): Page {
    this.promise = this.promise.catch(callback);
    return this;
  }

  finally(callback: ()=>void): Page {
    this.promise = this.promise.finally(callback);
    return this;
  }

}
