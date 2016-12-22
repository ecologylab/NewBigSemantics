/**
 * BigSemantics with PhantomJS for extraction.
 */

import * as path from 'path';
import * as Promise from 'bluebird';
import * as simpl from 'simpl.js';
import ParsedURL from '../core/ParsedURL';
import {
  MetaMetadata,
  BuildInfo,
  Repository,
  TypedRepository,
  TypedMetadata,
  BSResult,
} from '../core/types';
import { RepoOptions, RepoMan } from '../core/RepoMan';
import { RepoLoader, create } from '../core/RepoLoader';
import { Downloader } from '../core/Downloader';
import {
  BigSemantics,
  BigSemanticsOptions,
  BigSemanticsCallOptions,
} from '../core/BigSemantics';
import { AbstractBigSemantics } from '../api/AbstractBigSemantics';
import BSDefault from '../api/BSDefault';
import * as config from '../utils/config';
import { ServiceOptions } from './options';
import logger from './logging';
import RequestDownloader from './requestDownloader';
import Task from './task';
import * as pm from '../phantom/master';

/**
 * Files to inject for extraction
 * @type {string[]}
 */
const bsjsFiles = [
  path.join(__dirname, '../bigsemantics-core.bundle.js'),
];

/**
 *
 */
export interface BSPhantomOptions extends BigSemanticsOptions {
  appId: string;
  appVer: string;

  repository?: Repository | TypedRepository;
  repositoryUrl?: string | ParsedURL;
  serviceBase?: string | ParsedURL;

  repoOptions?: RepoOptions;
  cacheRepoFor?: string;
  disableRepoCaching?: boolean;
  requesterFactory?: ()=>Downloader;
}

/**
 *
 */
export interface BSPhantomCallOptions extends BigSemanticsCallOptions {
  task?: Task;

  ignoredSuffixes?: string[];
  proxy?: {
    endpoint: string;
    blacklist?: string[];
    whitelist?: string[];
  };
}

/**
 * Injected script can use this to talk back to the PhantomJS control page.
 */
declare var respond: (err: Error, metadata?: TypedMetadata)=>void;

/**
 *
 */
export class BSPhantom extends AbstractBigSemantics {
  private options: BSPhantomOptions;
  private repoLoader: RepoLoader;
  private repoMan: RepoMan;
  private master: pm.Master;

  /**
   * (Re)Load this instance with specified options.
   *
   * @param {BSWebAppOptions} options
   */
  load(options: BSPhantomOptions): void {
    this.reset();

    this.options = options;

    if (!this.options.requesterFactory) {
      this.options.requesterFactory = () => {
        return new RequestDownloader();
      };
    }

    this.repoLoader = create(this.options);
    this.repoLoader.getRepoMan().then(repoMan => {
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

  loadMetadata(location: string | ParsedURL, options?: BSPhantomCallOptions): Promise<BSResult> {
    return new Promise((resolve, reject) => {
      let purl = ParsedURL.get(location);

      let agent = this.master.randomAgent();
      let page = agent.createPage();

      let task: Task = options.task;

      return this.getSerializedRepository().then(serializedRepo => {
        page.onConsole(msg => {
          console.log("Console: " + msg);
        }).onError((err, trace) => {
          console.log("Error: " + err);
          task.log("Console Error", { err: err, trace: trace });
        });

        page.open(purl.toString(), null, options)
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

  getRepository(options?: BSPhantomCallOptions): Promise<Repository> {
    return this.repoMan.getRepository(options);
  }

  getSerializedRepository(options?: BSPhantomCallOptions): Promise<string> {
    return this.repoMan.getSerializedRepository(options);
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

export default BSPhantom;
