/**
 *
 */

import * as events from 'events';
import * as child_process from 'child_process';
import * as path from 'path';
import * as Promise from 'bluebird';
import * as config from '../utils/config';
import { PhantomOptions } from './options';
import logger from './logging';
import { CmdOptions, Page } from './page';

const phantomOptions = config.getOrFail('phantom', logger) as PhantomOptions;

/**
 * Options for phantomjs agents.
 */
export interface AgentOptions {
  host?: string;
  port?: number;
  pactFile?: string;
  noNewProcess?: boolean;
}

/**
 * Phantomjs agent. Holds a phantomjs instance (process), the socket for
 * communication, and all open pages on this instance.
 */
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
      let args = [
        this.options.pactFile || path.resolve(__dirname, 'pact.js'),
        this.id,
        this.options.host || 'localhost',
        '' + (this.options.port || phantomOptions.master_port),
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
        let task = JSON.parse(msg.text);
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

  createPage(options?: CmdOptions): Page {
    let pageId = this.id + '/p' + this.pageId++;
    // the purpose of this promise is to make sure pages are created in order.
    let promisedSocket = this.socket.then(s => s);
    this.socket = promisedSocket;
    let page = new Page(pageId, this, promisedSocket, options);
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

export default Agent;
