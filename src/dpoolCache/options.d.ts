/**
 * Options for minio-based cache.
 */

 /**
  *
  */
export interface DPoolCacheOptions {
  port: number;

  dpool_service: {
    host: string;
    port: number;
  }

  minio: {
    endpoint: string;
    port: number;
    secure_port: number;
    secure: boolean;
    access_key: string;
    secret_key: string;
  };
}
