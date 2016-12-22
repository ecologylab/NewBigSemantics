/**
 * Options for the BigSemantics service.
 */

import { PhantomOptions } from '../phantom/options';
/**
 *
 */
export interface ServiceOptions {
  port: number;
  secure_port?: number;
  use_https?: boolean;
  passphrase?: string;
  pfx_path?: string;

  repository_url?: string;
  service_base?: string;

  cache_repo_for?: string;

  dpool_service: {
    host: string;
    port: number;
  };

  metadata_cache?: {
    mongo?: {
      url: string;
      collection: string;
    };
  };
}
