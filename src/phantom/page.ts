/**
 *
 */

import * as events from 'events';
import * as Promise from 'bluebird';
import { deepClone, mergeInto } from '../utils/object';
import Agent from './agent';

/**
 *
 */
export interface ClientOptions {
  ignoredSuffixes?: string[];
  proxyService?: {
    endpoint?: string;
    blacklist?: string[];
    whitelist?: string[];
  }
}

/**
 *
 */
export interface PageOptions {
  id: string;
  agent: Agent;
  defaultClientOptions?: ClientOptions;
}

/**
 *
 */
export interface Params {
  pageId?: string;

  url?: string;
  content?: string;
  options?: ClientOptions;

  files?: string | string[];

  func?: string;
  args?: any[];
}

/**
 * A webpage. One can perform operations on it, such as open an URL or evaluate
 * a function. It has then(), catch(), finally() to enable retrieving the result
 * of most recent operation, handle errors, and cleaning up after use.
 */
export class Page extends events.EventEmitter {

  private id: string;
  private options: PageOptions;

  private msgId = 1;

  /**
   * A promise for a future value which will be the result of most recent
   * operation on this webpage.
   */
  private promise: Promise<any>;

  constructor(options: PageOptions) {
    super();

    this.options = options;
    this.id = this.options.id;

    this.promise = this.sendCmd('createPage', {
      pageId: this.id,
    });
  }

  getId(): string {
    return this.id;
  }

  getPromise(): Promise<any> {
    return this.promise;
  }

  private sendCmd(method: string, params?: Params): Promise<any> {
    let msgId = this.id + '/m' + this.msgId++;

    params = params || {
      pageId: this.id,
    };
    if (!params.pageId) {
      params.pageId = this.id;
    }
    let options = deepClone(this.options.defaultClientOptions);
    mergeInto(options, params.options);
    params.options = options;

    return this.options.agent.sendCmd(msgId, method, params);
  }

  private chain(promiseFactory: ()=>Promise<any>): void {
    this.promise = this.promise.then(promiseFactory);
  }

  /**
   * @param {string} url
   * @param {string} content
   * @param {ClientOptions} options
   * @return {Page}
   */
  open(url: string, content?: string, options?: ClientOptions): Page {
    this.chain(() => {
      let params: Params = {
        url: url,
        options: options,
      };
      if (content) {
        params.content = content;
        return this.sendCmd('setContent', params);
      } else {
        return this.sendCmd('open', params);
      }
    });
    return this;
  }

  injectJs(files: string|string[]): Page {
    this.chain(() => {
      let params = {
        files: (typeof files === 'string') ? [ files ] : files,
      };
      return this.sendCmd('injectJs', params);
    });
    return this;
  }

  evaluate(fn: Function | string, ...args: any[]): Page {
    this.chain(() => {
      let params = {
        func: (typeof fn === 'string') ? fn : fn.toString(),
        args: args,
      };
      return this.sendCmd('evaluate', params);
    });
    return this;
  }

  evaluateAsync(fn: Function | string, ...args: any[]): Page {
    this.chain(() => {
      let params = {
        func: (typeof fn === 'string') ? fn : fn.toString(),
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
