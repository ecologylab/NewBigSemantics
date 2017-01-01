/**
 * Options for downloader pool.
 */

/**
 *
 */
export interface DPoolOptions {
  port : number;

  cacheSize: number;
  defaultUserAgent: string;
  defaultMaxAttempts: number;
  defaultTimePerAttempt: number;

  workerStartPort: number;
  workerTaskTimeout: number;
  workerConnectionTimeout: number;
  workerMaxConnectionTimeout: number;

  dispatchingInterval: number;

  repositoryUrl: string;

  heartbeatTimeout: number;
  heartbeatInterval: number;
  heartbeatCycle: number;

  workerGroups: {
    group: string;
    port: number;
    user: string;
    identity: string;
    hosts: string[];
  }[];
}
