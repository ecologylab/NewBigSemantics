/**
 *
 */

import * as events from 'events';
import * as childProcess from 'child_process';
import * as Promise from 'bluebird';
import logger from './logging';
import { ClientOptions, Params, Page } from './page';

/**
 *
 */
export interface AgentOptions {
  id: string;
  defaultClientOptions?: ClientOptions;
}

/**
 *
 */
export interface AgentSummary {
  id: string,
  phantomProcessId: number,
  creationDate: Date,
  totalPagesOpened: number,

  tasks?: number,
  successfulTasks?: number,
  failedTasks?: number
}

/**
 * Phantomjs agent. Holds a phantomjs instance (process), the socket for
 * communication, and all open pages on this instance.
 */
export class Agent extends events.EventEmitter {

  private id: string;
  private options: AgentOptions;
  private creationDate: Date;

  private process: childProcess.ChildProcess;

  private socket: Promise<SocketIO.Socket>;

  private pages: { [id: string]: Page } = {};
  private pageId = 1;

  constructor(options: AgentOptions) {
    super();
    this.options = options;
    this.id = this.options.id;
    this.creationDate = new Date();
  }

  getId(): string {
    return this.options.id;
  }

  getCreationDate(): Date {
    return this.creationDate;
  }

  getPid(): number {
    return this.process ? this.process.pid : undefined;
  }

  getTotalPagesOpened(): number {
    return this.pageId - 1;
  }

  getSummary(): AgentSummary {
    return {
      id: this.getId(),
      phantomProcessId: this.getPid(),
      creationDate: this.getCreationDate(),
      totalPagesOpened: this.getTotalPagesOpened(),
    };
  }

  spawnProcess(host: string, port: number, pactFile: string): void {
    let args = [
      pactFile,
      this.id,
      host,
      '' + port,
    ];
    this.process = childProcess.spawn('phantomjs', args);
    this.process.stdout.on('data', data => {
      logger.info("PhantomJS stdout: " + data.toString());
    });
    this.process.stderr.on('data', data => {
      logger.warn("PhantomJS stderr: " + data.toString());
    });
    this.process.on('error', err => {
      logger.error({ err: err }, "PhantomJS error");
    });
    this.process.on('exit', (code, signal) => {
      logger.error("PhantomJS exited", { code: code, signal: signal });
    });
  }

  useProcess(process: childProcess.ChildProcess): void {
    this.process = process;
  }

  useSocket(socket: Promise<SocketIO.Socket>): void {
    this.socket = socket;
    this.socket.then(s => {
      s.on('response', msg => {
        logger.info("Received response for msg " + msg.id);
        this.emit('resp[' + msg.id + ']', msg);
      });

      s.on('console', msg => {
        logger.info("Page %s console output: %s", msg.id, msg.text);
        this.pages[msg.id].emit('console', msg.text);
      });

      s.on('error', msg => {
        logger.warn("Page %s error: %s, stack: %s", msg.id, msg.text, msg.params.stack);
        this.pages[msg.id].emit('error', { error: msg.text, stack: msg.params.satck });
      });

      // TODO s.on('event', handler)

      s.on('proxy-task-info', msg => {
        let proxyTask = JSON.parse(msg.text);
        logger.info("Page %s proxy task info: %o", msg.id, proxyTask);
        this.pages[msg.id].emit('proxy-task-info', proxyTask);
      });
    });
  }

  createPage(defaultClientOptions?: ClientOptions): Page {
    let pageId = this.getId() + '/p' + this.pageId++;
    let page = new Page({
      id: pageId,
      agent: this,
      defaultClientOptions: defaultClientOptions,
    });
    this.pages[pageId] = page;
    return page;
  }

  sendCmd(msgId: string, method: string, params?: Params): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.then(s => {
        s.emit('command', {
          id: msgId,
          method: method,
          params: params,
        });
      })

      this.once('resp[' + msgId + ']', resp => {
        if (resp.error) {
          logger.error({
            err: resp.error,
            msgId: msgId,
            method: method,
            params: params,
            resp: resp,
          });
          reject(resp.error);
          return;
        }
        resolve(resp.result);
      });
    });
  }

  shutdown(): Promise<boolean> {
    if (!this.socket) {
      return Promise.resolve(true);
    }
    return this.socket.then(s => {
      s.emit('exit');
      return true;
    });
  }

}

export default Agent;
