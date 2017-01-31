/**
 * Options for minio-based cache.
 */

 /**
  *
  */
export interface DPoolCacheOptions {
  port: number;

  dpoolService: {
    host: string;
    port: number;
  }

  minio: {
    endpoint: string;
    port: number;
    securePort: number;
    secure: boolean;
    accessKey: string;
    secretKey: string;
  };
}
