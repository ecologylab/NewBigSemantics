// The PhantomJS master.

import * as os from 'os';
import * as path from 'path';
import * as events from 'events';
import * as Promise from 'bluebird';
import * as http from 'http';
import * as express from 'express';
import * as SocketIO from 'socket.io';
import logger from './logging';
import Agent, { AgentOptions, AgentSummary } from './agent';
import { ClientOptions } from './page';

const defaultPactFile = path.resolve(__dirname, 'pact.js');

/**
 *
 */
export interface MasterOptions {
  masterPort: number;
  numberOfInitialAgents: number;
  pactFile?: string;
  agentConnectionTimeout?: number;
  defaultClientOptions?: ClientOptions;
}

/**
 * Master of multiple phantomjs processes and their agents. Runs the web and
 * websocket servers.
 *
 * Emits events: socket[<agentId>].init
 */
export class Master extends events.EventEmitter {

  private options: MasterOptions;

  private app: express.Express;
  private server: http.Server;
  private io: SocketIO.Server;

  private agents: { [id: string]: Agent } = {};
  private agentId = 1;

  constructor(options: MasterOptions) {
    super();

    this.options = options;

    this.app = express();
    this.server = http.createServer(this.app);
    this.io = SocketIO(this.server);
    this.app.use('/', express.static(path.resolve(__dirname, 'static')));
    this.server.listen(this.options.masterPort);

    let pactFile = this.options.pactFile || defaultPactFile;
    for (let i = 0; i < (this.options.numberOfInitialAgents || 1); ++i) {
      let id = os.hostname() + '/a' + this.agentId++;
      let agent = new Agent({
        id: id,
        defaultClientOptions: this.options.defaultClientOptions,
      });
      agent.spawnProcess('localhost', this.options.masterPort, pactFile);
      let socket = new Promise<SocketIO.Socket>((resolve, reject) => {
        this.once('socket[' + id + '].init', socketOrError => {
          if (socketOrError instanceof Error) {
            reject(socketOrError);
            return;
          }
          resolve(socketOrError);
        });
      });
      if (this.options.agentConnectionTimeout > 0) {
        socket = socket.timeout(this.options.agentConnectionTimeout);
      }
      agent.useSocket(socket);
      this.agents[id] = agent;
    }

    this.io.on('connection', socket => {
      socket.on('init', msg => {
        let agentId = msg.agentId;
        if (!agentId) {
          logger.error("Missing agentId in received init message: %o", msg);
          return;
        }
        let agent = this.agents[agentId];
        if (agent) {
          this.emit('socket[' + agentId + '].init', socket);
        } else {
          agent = new Agent({
            id: agentId,
            defaultClientOptions: this.options.defaultClientOptions,
          });
          agent.useSocket(Promise.resolve(socket));
          this.agents[agentId] = agent;
        };
      });
    });
  }

  randomAgent(): Agent {
    let ids = Object.keys(this.agents);
    let i = Math.floor(ids.length * Math.random());
    return this.agents[ids[i]];
  }

  agentsInfo(): AgentSummary[]  {
    let result: AgentSummary[] = [];
    for (let agentID in this.agents) {
      let agent = this.agents[agentID];
      result.push(agent.getSummary());
    }
    return result;
  }

  shutdown(): Promise<boolean> {
    let shutdownPromises =
      Object.keys(this.agents).map(id => this.agents[id]).map(a => a.shutdown());
    return Promise.all(shutdownPromises).then(() => {
      this.io.close();
      this.server.close();
      return true;
    });
  }

}

export default Master;
