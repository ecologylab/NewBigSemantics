/**
 * Options for the BigSemantics service.
 */

import { MasterOptions } from '../phantom/master';

/**
 *
 */
export interface ServiceOptions {
  port: number;
  securePort?: number;
  useHttps?: boolean;
  passphrase?: string;
  pfxPath?: string;

  repositoryUrl?: string;
  serviceBase?: string;
  cacheRepoFor?: string;

  phantomService: MasterOptions;

  dpoolService: {
    host: string;
    port: number;
    proxyPath?: string;
  };

  metadataCache?: {
    mongo?: {
      url: string;
      collection: string;
    };
  };
}
