/**
 * BigSemantics with PhantomJS for extraction.
 */

import * as Promise from 'bluebird';
import * as simpl from 'simpl.js';
import ParsedURL from '../core/ParsedURL';
import Readyable from '../core/Readyable';
import {
  MetaMetadata,
  BuildInfo,
  TypedRepository,
  TypedMetadata,
  BSResult,
} from '../core/types';
import RepoMan, { RepoOptions } from '../core/RepoMan';
import {
  BigSemantics,
  BigSemanticsOptions,
  BigSemanticsCallOptions
} from '../core/BigSemantics';
import ServiceRepoLoader from '../downloaders/ServiceRepoLoader';
import BSDefault from '../api/BSDefault';
import { AbstractBigSemantics } from '../api/AbstractBigSemantics';
import { Downloader } from '../core/Downloader';
import RequestDownloader from './request-downloader';
import { Task } from './task';
import * as pm from '../phantom/master';

/**
 * Files to inject for extraction
 * @type {string[]}
 */
let bsjsFiles = [
  '../../BigSemanticsJavaScript/build/bigsemantics-core.js',
];

/**
 * @type {string[]}
 */
export const ignoreSuffixes = ['jpg', 'jpeg', 'tiff', 'gif', 'bmp', 'png', 'tga', 'css'];

/**
 *
 */
export interface BSPhantomOptions extends BigSemanticsOptions {
  appId: string;
  appVer: string;
  serviceBase: string | ParsedURL;
  repoOptions?: RepoOptions;
  cacheRepoFor?: string; // e.g. 30d, 20h, 30m, 5d12h30m
  requesterFactory?: ()=>Downloader;
  ignoreSuffixes?: string[];
  proxy_url?: string;
  proxy_blacklist?: string[];
}

/**
 *
 */
export interface BSPhantomCallOptions extends BigSemanticsCallOptions {
  task?: Task;
  ignoreSuffixes?: string[];
  proxy_url?: string;
  proxy_blacklist?: string[];
}

/**
 *
 */
declare var respond: (err: Error, metadata?: TypedMetadata)=>void;

/**
 *
 */
export default class BSPhantom extends AbstractBigSemantics {
  private options: BSPhantomOptions;
  private serviceRepoLoader: ServiceRepoLoader;
  private repoMan: RepoMan;
  private serializedRepo: string;
  private master: pm.Master;

  /**
   * (Re)Load this instance with specified options.
   *
   * @param {BSWebAppOptions} options
   */
  load(options: BSPhantomOptions): void {
    this.reset();

    this.options = options;
    if (!this.options.ignoreSuffixes) {
      this.options.ignoreSuffixes = ignoreSuffixes;
    }

    this.serviceRepoLoader = new ServiceRepoLoader();
    if (!this.options.requesterFactory) {
      this.options.requesterFactory = () => {
        return new RequestDownloader();
      };
    }
    this.serviceRepoLoader.load(options);
    this.serviceRepoLoader.getRepoMan().then(repoMan => {
      this.repoMan = repoMan;
      this.repoMan.onReadyP().then(() => {
        if (!this.master) {
          this.master = new pm.Master();
        }
        this.setReady();
      });
    })
  }

  getRepoMan(): RepoMan {
    return this.repoMan;
  }

  getMaster(): pm.Master {
    return this.master;
  }

  private getSerializedRepository(): Promise<string> {
    if (this.serializedRepo) {
      return Promise.resolve(this.serializedRepo);
    }
    return this.getRepository().then(repo => simpl.serialize(repo));
  }

  loadMetadata(location: string | ParsedURL, options?: BSPhantomCallOptions): Promise<BSResult> {
    return new Promise((resolve, reject) => {
      let purl = ParsedURL.get(location);

      let agent = this.master.randomAgent();
      let page = agent.createPage();

      let task: Task = options.task;

      return this.getSerializedRepository().then(serializedRepo => {
        let tasks = []; // FIXME what does this list do?

        let ignoreSuffixes = options.ignoreSuffixes || this.options.ignoreSuffixes;
        page.setIgnoredSuffixes(ignoreSuffixes)
            .onConsole(msg => console.log("Console: " + msg))
            .onError((err, trace) => {
              console.log("Error: " + err);
              task.log("Console Error", { err: err, trace: trace });
            })
            .onTask(task => tasks.push(task));

        let proxyUrl = options.proxy_url || this.options.proxy_url;
        if (proxyUrl) {
          if (task) {
            task.log("Using Proxy", proxyUrl);
          }
          page.setProxy(proxyUrl);
        }

        let proxyBlacklist = options.proxy_blacklist || this.options.proxy_blacklist;
        if (proxyBlacklist) {
          page.setProxyBlacklist(proxyBlacklist);
        }

        page.open(purl.toString())
            .injectJs(bsjsFiles)
            .evaluateAsync(function(serializedRepo) {
              var options = {
                appId: 'bsphantom-client',
                appVer: '0.0.0',
                repository: simpl.deserialize(serializedRepo)
              };

              var bs: BSDefault;
              // Quick fix because TypeScript changes to BigSemantics_1
              eval("bs = new bigsemantics.BSDefault();");

              bs.loadMetadata(document.location.href, {
                response: {
                  code: 200,
                  entity: document,
                  location: document.location.href
                }
              }).then(function(result: BSResult) {
                respond(null, result.metadata);
              }).catch(function(err: Error) {
                respond(err);
              });
            }, serializedRepo)
            .then((result: TypedMetadata) => {
              result['dpoolTasks'] = tasks;
              resolve(result);
            })
            .close()
            .catch(err => {
              reject(err);
            });
      });
    });
  }

  getBuildInfo(options?: BSPhantomCallOptions): Promise<BuildInfo> {
    return this.repoMan.getBuildInfo(options);
  }

  getRepository(options?: BSPhantomCallOptions): Promise<TypedRepository> {
    return this.repoMan.getRepository(options);
  }

  getUserAgentString(userAgentName: string, options?: BSPhantomCallOptions): Promise<string> {
    return this.repoMan.getUserAgentString(userAgentName, options);
  }

  getDomainInterval(domain: string, options?: BSPhantomCallOptions): Promise<number> {
    return this.repoMan.getDomainInterval(domain, options);
  }

  loadMmd(name: string, options?: BSPhantomCallOptions): Promise<MetaMetadata> {
    return this.repoMan.loadMmd(name, options);
  }

  selectMmd(location: string | ParsedURL, options?: BSPhantomCallOptions): Promise<MetaMetadata> {
    return this.repoMan.selectMmd(name, options);
  }

  normalizeLocation(location: string | ParsedURL, options?: BSPhantomCallOptions): Promise<string> {
    return this.repoMan.normalizeLocation(location, options);
  }
}
