/**
 * A MetadataCache implementation using mongo.
 * FIXME More work needed on MongoMetadataCache
 */

import * as Promise from 'bluebird';
import * as mongo from "mongodb";
import RepoMan from "../core/RepoMan";
import { MetaMetadata, TypedMetadata, Metadata, BSResult } from '../core/types';
import * as config from '../utils/config';
import { ServiceOptions } from './options';
import { parseDuration } from '../utils/datetime';
import logger from "./logging";
import { ReadThrough, MetadataCache } from './metadataCache';

/**
 *
 */
export interface MongoMetadataCacheOptions {
  repoMan: RepoMan;
  mongo: {
    url: string;
    collection: string;
  };
}

/**
 *
 */
export interface MongoMetadataCacheEntry {
  /**
   * Metadata location, or generated ID if metadata has no location.
   */
  location?: string;

  metadata: TypedMetadata;
  mmdName?: string;
  mmdHashCode?: number;

  modified?: Date;
}

/**
 * Class for retrieving metadata from MongoDB.
 * Allows for a readThrough function.
 */
export class MongoMetadataCache implements MetadataCache {

  private options: MongoMetadataCacheOptions;

  private ready: Promise<void>;

  private defaultCacheLife: string;

  private db: mongo.Db;
  private mdCollection: mongo.Collection;

  constructor(options: MongoMetadataCacheOptions) {
    this.options = options;
  }

  /**
   * Sets up connection to MongoDB with the parameters supplied in the
   * constructor.
   */
  connect(): Promise<void> {
    this.ready = this.options.repoMan.getRepository().then(repo => {
      this.defaultCacheLife = repo.default_cache_life;
      logger.info("Default cache life: " + this.defaultCacheLife);
    }).then(() => {
      return mongo.MongoClient.connect(this.options.mongo.url);
    }).then(db => {
      this.db = db;
      this.mdCollection = db.collection(this.options.mongo.collection);
    });

    return this.ready.catch(err => {
      logger.fatal({ err: err }, "Could not connect to MongoDB");
      throw err;
    });
  }

  /**
   * Retrieves metadata from cache, if not found calls readThrough function.
   *
   * @param {string} key The URL.
   * @param {ReadThrough} readThrough
   * @returns {Promise<BSResult>}
   */
  get(key: string, readThrough: ReadThrough): Promise<BSResult> {
    return this.ready.then(() => {
      let mmd: MetaMetadata = null;
      let doCache = false;
      let cacheLife: number = 0;
      let expireDate: number = null;

      // yuck
      return this.options.repoMan.selectMmd(key).then(mmd => {
        doCache = !mmd.no_cache;
        cacheLife = parseDuration(mmd.cache_life || this.defaultCacheLife, 'd');

        let pEntry = Promise.resolve(this.mdCollection.findOne({
          location: key,
        })) as Promise<MongoMetadataCacheEntry>;
        return pEntry.catch(err => {
          logger.fatal({ err: err }, "Could not retrieve metadata from cache");
          return null;
        });
      }).then((entry: MongoMetadataCacheEntry) => {
        // check if metadata has expired or doesn't match the mmd's current fingerprint
        expireDate = entry.modified.getTime() + cacheLife;
        if (entry && expireDate > Date.now() && entry.mmdHashCode === mmd.hash_code) {
          return entry;
        }
        // entry expired or is corrupted
        return this.mdCollection.deleteMany({
          location: key,
        }).then(() => null).catch(err => {
          logger.error({ err: err }, "Could not deleted expired or corrupted entry from cache");
          return null;
        });
      }).then(entry => {
        if (entry && entry.metadata) {
          return {
            metadata: entry.metadata,
            mmd: mmd,
          } as BSResult;
        }
        return readThrough(key).catch(err => {
          logger.error({ err: err }, "Could not retrieve metadata using readThrough");
          throw err;
        });
      }).then(result => {
        if (doCache) {
          this.put(key, result).catch(err => {
            logger.error({ err: err }, "Could not store metadata in cache");
          });
        }
        return result;
      });
    });
  }

  /**
   * Stores metadata in MongoDB metadata collection
   * Key likely being a URL
   */
  put(key: string, result: BSResult): Promise<void> {
    return this.ready.then(() => {
      if (!result.metadata) {
        throw new Error("Result must contain metadata");
      }

      let mmdName = result.metadata.metadata_type_name;

      let pMmd: Promise<MetaMetadata> = null;
      if (result.mmd) {
        pMmd = Promise.resolve(result.mmd);
      } else {
        pMmd = this.options.repoMan.loadMmd(mmdName);
      }

      return pMmd.then(mmd => {
        let entry: MongoMetadataCacheEntry = {
          location: key,
          metadata: result.metadata,
          mmdName: mmdName,
          mmdHashCode: mmd.hash_code,
          modified: new Date(),
        };
        return this.mdCollection.insert(entry).then(() => null).catch(err => {
          logger.error({ err: err }, "Cannot write to mongo metadata cache!");
        });
      });
    });
  }

}

export default MongoMetadataCache;
