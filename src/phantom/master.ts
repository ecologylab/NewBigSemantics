// The PhantomJS master.

import * as os from 'os';
import * as path from 'path';
import * as events from 'events';
import * as Promise from 'bluebird';
import * as http from 'http';
import * as express from 'express';
import * as SocketIO from 'socket.io';
import * as config from '../utils/config';
import { PhantomOptions } from './options';
import logger from './logging';
import Agent, { AgentOptions } from './agent';

const phantomOptions = config.getOrFail('phantom', logger) as PhantomOptions;

/**
 * Detailed information of an Agent.
 */
export interface AgentInfo {
  pid: number,
  id: string,
  creationDate: Date,
  pagesOpened: number,
  tasks?: number,
  successfulTasks?: number,
  failedTasks?: number
}

/**
 * Master of multiple phantomjs processes and their agents. Runs the web and
 * websocket servers.
 *
 * Emits events: socket[<agentId>].init
 */
export class Master extends events.EventEmitter {

  private app: express.Express;
  private server: http.Server;
  private io: SocketIO.Server;

  private agents: { [id: string]: Agent } = {};
  private agentId = 1;

  constructor() {
    super();

    this.app = express();
    this.server = http.createServer(this.app);
    this.io = SocketIO(this.server);
    this.app.use('/', express.static(path.resolve(__dirname, 'static')));
    this.server.listen(phantomOptions.master_port);

    for (var i = 0; i < (phantomOptions.number_of_initial_agents || 1); ++i) {
      this.newAgent(null, null);
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

  public agentsInfo(): AgentInfo[]  {
    var info: Array<AgentInfo> = [];

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

  private newAgent(
    agentId: string,
    promisedSocket?: Promise<SocketIO.Socket>,
    agentOptions?: AgentOptions
  ): Agent {
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

export default Master;
