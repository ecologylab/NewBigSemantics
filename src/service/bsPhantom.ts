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
  BSResult,
} from '../core/types';
import { RepoOptions, RepoMan } from '../core/RepoMan';
import { RepoLoader, create } from '../core/RepoLoader';
import { Downloader } from '../core/Downloader';
import { BigSemanticsOptions, BigSemanticsCallOptions } from '../core/BigSemantics';
import { AbstractBigSemantics } from '../api/AbstractBigSemantics';
import BSDefault from '../api/BSDefault';
import RequestDownloader from './requestDownloader';
import Task from './task';
import { MasterOptions, Master } from '../phantom/master';
import { ClientOptions } from '../phantom/page';

/**
 * Files to inject for extraction.
 * @type {string[]}
 */
const jsFilesToInject = [
  path.resolve(__dirname, '../../build/bigsemantics-core.bundle.js'),
];

/**
 *
 */
export interface BSPhantomOptions extends BigSemanticsOptions {
  appId: string;
  appVer: string;

  phantomService: MasterOptions;

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
export interface BSPhantomCallOptions extends BigSemanticsCallOptions, ClientOptions {
  task: Task;

  ignoredSuffixes?: string[];
  proxyService?: {
    endpoint?: string;
    blacklist?: string[];
    whitelist?: string[];
  };
}

/**
 *
 */
export class BSPhantom extends AbstractBigSemantics {

  private options: BSPhantomOptions;
  private repoLoader: RepoLoader;
  private repoMan: RepoMan;
  private master: Master;

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
          this.master = new Master(options.phantomService);
        }
        this.setReady();
      });
    })
  }

  getRepoMan(): RepoMan {
    return this.repoMan;
  }

  getMaster(): Master {
    return this.master;
  }

  loadMetadata(location: string | ParsedURL, options: BSPhantomCallOptions): Promise<BSResult> {
    return new Promise((resolve, reject) => {
      let purl = ParsedURL.get(location);

      let agent = this.master.randomAgent();
      let page = agent.createPage();

      let task: Task = options.task;

      this.getSerializedRepository().then(serializedRepo => {
        page
          .open(purl.toString(), null, options)
          .injectJs(jsFilesToInject)
          .evaluateAsync(`function(serializedRepo) {
            var repository = bigsemantics.deserialize(serializedRepo);

            var bs = new bigsemantics.BSDefault();
            bs.load({
              appId: 'bsphantom-client',
              appVer: '0.0.0',
              repository: repository
            });

            bs.loadMetadata(document.location.href, {
              response: {
                code: 200,
                entity: document,
                location: document.location.href
              }
            }).then(function(result) {
              bigsemantics.graphCollapse(result);
              respond(null, result);
            }).catch(function(err) {
              respond(err);
            });
          }`, serializedRepo)
          .then((result: BSResult) => {
            simpl.graphExpand(result);
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
    return this.repoMan.selectMmd(location, options);
  }

  normalizeLocation(location: string | ParsedURL, options?: BSPhantomCallOptions): Promise<string> {
    return this.repoMan.normalizeLocation(location, options);
  }

}

export default BSPhantom;
