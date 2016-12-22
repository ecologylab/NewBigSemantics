/**
 *
 */

import * as events from 'events';
import * as Promise from 'bluebird';
import * as config from '../utils/config';
import { PhantomOptions } from './options';
import logger from './logging';
import Agent from './agent';

const phantomOptions = config.getOrFail('phantom', logger) as PhantomOptions;

/**
 *
 */
export interface CmdOptions {
  ignoredSuffixes?: string[];

  proxy?: {
    endpoint: string;
    blacklist?: string[];
    whitelist?: string[];
  }

  logResourceError?: boolean;
  logResourceTimeout?: boolean;
}

/**
 * A webpage. One can perform operations on it, such as open an URL or evaluate
 * a function. It has then(), catch(), finally() to enable retrieving the result
 * of most recent operation, handle errors, and cleaning up after use.
 */
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

  constructor(
    id: string,
    agent: Agent,
    socket: Promise<SocketIO.Socket>,
    options?: CmdOptions
  ) {
    super();

    this.id = id;

    this.agent = agent;
    this.socket = socket;

    let mapKey = (key: string) => {
      key = key.replace(/^default_/, '');
      key = key.replace(/_\w/g, m => m.substr(1).toUpperCase());
      return key;
    };

    options = config.mergeFieldInto(options, phantomOptions, 'default_ignored_suffixes', mapKey);
    options = config.mergeFieldInto(options, phantomOptions, 'proxy', mapKey);

    this.promise = this.sendCmd('createPage', {
      pageId: this.id,
      options: options,
    });
  }

  newTask(task: any) {
    if (this.taskCallback) {
      this.taskCallback(task);
    }
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

  onTask(callback: (task: any) => void): Page {
    this.taskCallback = callback;
    return this;
  }

  onConsole(callback: (msg: string) => void): Page {
    this.consoleCallback = callback;
    return this;
  }

  onError(callback: (msg: string, trace: string) => void): Page {
    this.errorCallback = callback;
    return this;
  }

  private sendCmd(method: string, params?: any): Promise<any> {
    return this.socket.then(s => {
      let msgId = this.id + '/m' + this.msgId++;
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

  /**
   * @param {string} url
   * @param {string} content
   * @param {CmdOptions} options
   * @return {Page}
   */
  open(url: string, content?: string, options?: CmdOptions): Page {
    this.chain(() => {
      let params: any = { url: url, options: options };
      if (content) {
        params.content = content;
        return this.sendCmd('setContent', params);
      } else {
        return this.sendCmd('open', params);
      }
    });
    return this;
  }

  setIgnoredSuffixes(suffixes: string[]): Page {
    this.chain(() => {
      let params = { suffixes: suffixes };
      return this.sendCmd('setIgnoredSuffixes', params);
    });
    return this;
  }

  setProxy(proxyEndpoint: string): Page {
    this.chain(() => {
      let params = { proxyEndpoint: proxyEndpoint };
      return this.sendCmd('setProxy', params);
    });
    return this;
  }

  setProxyBlacklist(patterns: string[]): Page {
    this.chain(() => {
      let params = { patterns: patterns };
      return this.sendCmd('setProxyBlacklist', params);
    });
    return this;
  }

  setProxyWhitelist(patterns: string[]): Page {
    this.chain(() => {
      let params = { patterns: patterns };
      return this.sendCmd('setProxyWhitelist', params);
    });
    return this;
  }

  injectJs(files: string|string[]): Page {
    this.chain(() => {
      let params = { files: files };
      return this.sendCmd('injectJs', params);
    });
    return this;
  }

  evaluate(fn: Function, ...args: any[]): Page {
    this.chain(() => {
      let params = {
        func: fn.toString(),
        args: args,
      };
      return this.sendCmd('evaluate', params);
    });
    return this;
  }

  evaluateAsync(fn: Function, ...args: any[]): Page {
    this.chain(() => {
      let params = {
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

export default Page;
