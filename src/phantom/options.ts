/**
 * Phantom related options.
 */

export interface PhantomOptions {
  master_port: number;
  number_of_initial_agents?: number;

  default_ignored_suffixes?: string[];

  proxy_service?: {
    endpoint: string;
    default_blacklist?: string[];
    default_whitelist?: string[];
  }
}
