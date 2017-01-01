// Corresponds to Minio-js version 2.0.3
// Made from https://docs.minio.io/docs/javascript-client-api-reference
// (NPM module isn't up to date with documentation)

declare module "minio" {
  import * as stream from 'stream';
  import * as events from 'events';

  interface ClientConfiguration {
    endPoint: string,
    accessKey: string,
    secretKey: string,

    port?: number,
    secure?: boolean
  }

  interface Bucket {
    name: string;
    creationDate: Date;
  }

  interface MinioObject {
    name: string;
    size: number;
    etag: string;
    lastModified: Date;
  }

  interface IncompleteUpload {
    key: string;
    uploadId: string;
    size: number;
  }

  interface Stat {
    size: number;
    etag: string;
    contentType: string;
    lastModified: string;
  }

  class CopyConditions {
    setModified(nativeDate: Date);
    setUnmodified(nativeDate: Date);
    setMatchETag(etag: string);
    setMatchETagExcept(etag: string);
  }

  class PostPolicy {
    setExpires(nativeDate: Date);
    setKey(objectName: string);
    setKeyStartsWith(prefix: string);
    setBucket(bucketName: string);
    setContentType(type: string);
    setContentLengthRange(min: number, max: number);
  }

  class NotificationConfig {
    TopicConfiguration: any[];
    QueueConfiguration: any[];
    CloudFunctionConfiguration: any[];

    add(target: any);
  }

  class Stream<T> extends stream.Stream {
    on(event: string, callback: () => void);
    on(event: "data", callback: (obj: T) => void);
    on(event: "error", callback: (err) => void);
    on(event: "end", callback: () => void);
  }

  class minio {
    constructor(config: ClientConfiguration);

    /**
     * Creates a new bucket.
     */
    makeBucket(bucketName: string, region: string, callback: (err) => void);
    /**
     * Lists all buckets.
     */
    listBuckets(callback: (err, bucketStream: Stream<Bucket>) => void);
    /**
     * Checks if a bucket exists.
     */
    bucketExists(bucketName: string, callback: (err) => void);
    /**
     * Removes a bucket.
     */
    removeBucket(bucketName: string, callback: (err) => void);
    /**
     * Lists all objects in a bucket.
     */
    listObjects(bucketName: string, prefix?: string, recursive?: boolean): Stream<MinioObject>;
    /**
     * Lists all objects in a bucket using S3 listing objects V2 API
     */
    listObjectsV2(bucketName: string, prefix?: string, recursive?: boolean): Stream<MinioObject>;
    /**
     * Lists partially uploaded objects in a bucket.
     */
    listIncompleteUploads(bucketName: string, prefix?: string, recursive?: boolean): Stream<IncompleteUpload>;

    /**
     * Downloads an object as a stream.
     */
    getObject(bucketName: string, objectName: string, callback: (err, stream: Stream<any[]>) => void);
    /**
     * Downloads the specified range bytes of an object as a stream.
     */
    getPartialObject(bucketName: string, objectName: string, offset: number, length: number, callback: (err, stream: Stream<any[]>) => void);
    /**
     * Downloads and saves the object as a file in the local filesystem.
     */
    fGetObject(bucketName: string, objectName: string, filePath: string, callback: (err) => void);
    /**
     * Uploads an object from a stream/Buffer.
     */
    putObject(bucketName: string, objectName: string, stream: stream.Stream, size: number, contentType: string, callback: (err, etag: string) => void);
    /**
     * Uploads an object from a string/Buffer.
     */
    putObject(bucketName: string, objectName: string, str: string, contentType: string, callback: (err, etag: string) => void);
    /**
     * Uploads contents from a file to objectName.
     */
    fPutObject(bucketName: string, objectName: string, filePath: string, contentType: string, callback: (err, etag: string) => void);
    /**
     * Copy a source object into a new object in the specied bucket.
     */
    copyObject(bucketName: string, objectName: string, sourceObject: string, conditions: CopyConditions, callback: (err, { etag: string, lastModified: Date}) => void);
    /**
     * Gets metadata of an object.
     */
    statObject(bucketName: string, objectName: string, callback: (err, stat: Stat) => void);
    /**
     * Removes an object.
     */
    removeObject(bucketName: string, objectName: string, callback: (err) => void);
    /**
     * Removes a partially uploaded object.
     */
    removeIncompleteUpload(bucketName: string, objectName: string, callback: (err) => void);

    /**
     * Generates a presigned URL for HTTP GET operations. Browsers/Mobile clients may point to this URL to directly download objects even if the bucket is private. This presigned URL can have an associated expiration time in seconds after which the URL is no longer valid. The default expiry is set to 7 days.
     */
    presignedGetObject(bucketName: string, objectName: string, expiry: number, callback: (err, presignedUrl: string) => void);
    /**
     * Generates a presigned URL for HTTP PUT operations. Browsers/Mobile clients may point to this URL to upload objects directly to a bucket even if it is private. This presigned URL can have an associated expiration time in seconds after which the URL is no longer valid. The default expiry is set to 7 days.
     */
    presignedPutObject(bucketName: string, objectName: string, expiry: number, callback: (err, presignedUrl: string) => void);
    /**
     * Allows setting policy conditions to a presigned URL for POST operations. Policies such as bucket name to receive object uploads, key name prefixes, expiry policy may be set.
     */
    presignedPostPolicy(bucketName: PostPolicy, callback: (err, postURL: string, formData: any) => void);

    /**
     * Fetch the notification configuration stored in the S3 provider and that belongs to the specified bucket name.
     */
    getBucketNotification(bucketName: string, cb: (err, bucketNotificationConfig: NotificationConfig) => void);
    /**
     * Upload a user-created notification configuration and associate it to the specified bucket name.
     */
    setBucketNotification(bucketName: string, bucketNotificationConfig: NotificationConfig, callback: (err) => void);
    /**
     * Remove the bucket notification configuration associated to the specified bucket.
     */
    removeAllBucketNotification(bucketName: string, callback: (err) => void);
    listenBucketNotification(bucketName: string, prefix: string, suffix: string, events: string[]): events.EventEmitter;
    /**
     * Get the bucket policy associated with the specified bucket. If objectPrefix is not empty, the bucket policy will be filtered based on object permissions as well.
     */
    getBucketPolicy(bucketName: string, objectPrefix: string, callback: (err, policy: string) => void);
    /**
     * Set the bucket policy associated with the specified bucket. If objectPrefix is not empty, the bucket policy will only be assigned to objects that fit the given prefix.
     */
    setBucketPolicy(bucketName: string, objectPrefix: string, bucketPolicy: string, callback: (err) => void);

    newPostPolicy(): PostPolicy;
  }

  namespace minio { }
  export = minio;
}
