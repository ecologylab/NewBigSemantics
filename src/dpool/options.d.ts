/**
 * Options for downloader pool.
 */

/**
 *
 */
export interface DPoolOptions {
  port : number;
  cache_size: number;
  user_agent: string;

  repository_url: string;

  dispatching_interval: number;
  max_attempts: number;
  time_per_attempt: number;

  heartbeat_timeout: number;
  heartbeat_interval: number;
  heartbeat_cycle: number;

  worker_start_port: number;
  worker_task_timeout: number;
  worker_connection_timeout: number;
  worker_max_connection_timeout: number;

  worker_groups: {
    group: string;
    port: number;
    user: string;
    identity: string;
    hosts: string[];
  }[];
}
