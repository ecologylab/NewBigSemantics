import * as mongo from "mongodb";
import { logger } from "./logging";
import { sha256, base32enc } from "../utils/codec"
import RepoMan from "../core/RepoMan";

let MongoClient = mongo.MongoClient;

export interface MetadataCacheSettings {
  repoMan: RepoMan;
  mmdRepo: any;

  mongo: {
    url: string;
    collection: string;
  };
}

/**
 * Function for getting expiration date from duration
 * For use in expiring mmd caches
 */
function getExpirationDate(duration: string): Date {
  let units = parseInt(duration);
  let suffix = duration[duration.length - 1];
  let result = new Date();

  switch (suffix) {
    default: //default to days if invalid
    case 'd': result.setDate(result.getDate() + units); break;
    case 'h': result.setTime(result.getTime() + units * 60 * 60 * 1000); break;
    case 'm': result.setTime(result.getTime() + units * 60 * 1000); break;
  }

  return result;
}

/**
 * Calculates hash of meta-metadata object
 * If hash is different we invalidate the cached metadata
 */
function calculateMmdHash(mmd) {
  let fingerprint = "";
  let stack = [mmd];

  while (stack.length > 0) {
    let obj = stack.pop();

    // somethings we push in strings and the like
    if (typeof obj !== "object") {
      continue;
    }

    if (obj.visited) continue;
    obj.visited = true;

    // skip past wrappers for these
    if (obj.meta_metadata) obj = obj.meta_metadata;
    if (obj.scalar) obj = obj.scalar;
    if (obj.composite) obj = obj.composite;
    if (obj.collection) obj = obj.collection;

    // likely need to consider more fields
    fingerprint +=
      obj.name +
      obj.parser +
      (obj.xpaths && obj.xpaths.join("")) +
      (obj.selectors && obj.selectors.map(s => s["url_regex_fragment"] + s["domain"]).join(""));

    if (obj.super_field) {
      stack.push(obj.super_field);
    }

    if (obj.kids) {
      for (let child of obj.kids) {
        stack.push(child);
      }
    }
  }

  return base32enc(sha256(fingerprint));
}

/**
 * Class for retrieving metadata from MongoDB
 * Allows for a readThrough function in case Metadta
 */
export class MetadataCache {
  settings: MetadataCacheSettings;

  db: mongo.Db;
  mdCollection: mongo.Collection;

  defaultCacheDuration: string;

  constructor(settings: MetadataCacheSettings) {
    this.settings = settings;

    // todo: add getDefaultExpiration to RepoMan
    let repo = settings.mmdRepo;
    this.defaultCacheDuration = repo.meta_metadata_repository.default_cache_life;
    console.log("Cache period: " + this.defaultCacheDuration);
  }

  /**
   * Sets up connection to MongoDB with the parameters supplied in the constructor
   */
  async connect() {
    let db = await MongoClient.connect(this.settings.mongo.url).catch(err => {
      logger.fatal({ err: err }, "Could not connect to MongoDB");
      throw err;
    });

    this.db = db;
    this.mdCollection = db.collection(this.settings.mongo.collection);
  }

  /**
   * Retrieves metadata from cache, if not found calls readThrough function
   */
  async get(key: string, readThrough: (key: string) => Promise<any>) {
    let repoMan = this.settings.repoMan;

    let mmd = await repoMan.selectMmd(key, null).catch(e => {
      logger.fatal({ err: e }, `Could not get mmd for ${key}`);
      // in async function this will just go to the catch branch
      // of the resulting promise
      throw e;
    }) as any;

    if(!mmd.fingerprint) {
      mmd.fingerprint = calculateMmdHash(mmd);
    }

    let cache = !mmd.no_cache;
    let expirationDuration = mmd.cache_life || this.defaultCacheDuration;
    let expirationDate = getExpirationDate(expirationDuration);

    let res = await this.mdCollection.findOne({ key: key}).catch(e => {
      logger.fatal("Could not retrieve metadata from cache");
    });

    // check if metadata has expired or doesn't match the mmd's current fingerprint
    let md = res && res.metadata;
    if(md && md.expires > new Date() && md.mmdFingerprint === mmd.fingerprint) {
      return {
        metadata: md.metadata
      };
    } else if(md) {
      // if md isn't null/undefined, it must be in database, but expired
      // so delete it

      // await to prevent somewhat possible race condition
      await this.mdCollection.deleteMany({ key: key }).catch(e => {
        logger.error({ err: e }, "Could not deleted expired metadata from cache");
      });
    }

    // couldn't get metadata from cache, so use readThrough function
    md = await readThrough(key).catch(e => {
      logger.error({ err: e}, "Could not retrieve metadata from readThrough function");
      throw e;
    });

    if(cache) {
      this.put(key, {
        metadata: md.metadata,
        expires: expirationDate,
        mmdFingerprint: mmd.fingerprint
      }).catch(err => {
        logger.error({ err: err }, "Could not store metadata in cache");
      });
    }

    return md;
  }

  /**
   * Stores metadata in MongoDB metadata collection
   * Key likely being a URL
   */
  put(key: string, md: any) {
    return this.mdCollection.insert({
      key: key,
      metadata: md
    });
  }
}