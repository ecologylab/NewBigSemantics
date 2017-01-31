/**
 * General MetadataCache interface, and a dummy implementation.
 */

import * as Promise from 'bluebird';
import { MetaMetadata, TypedMetadata, BSResult } from '../core/types';

/**
 * 
 */
export interface ReadThrough {
  (url: string): Promise<BSResult>;
}

/**
 *
 */
export interface MetadataCache {
  connect(): Promise<void>;
  get(key: string, readThrough: ReadThrough): Promise<BSResult>;
  put(key: string, result: BSResult): void;
}

/**
 *
 */
export class DummyMetadataCache implements MetadataCache {
  connect(): Promise<void> {
    return Promise.resolve();
  }

  get(key: string, readThrough: ReadThrough): Promise<BSResult> {
    if (!readThrough) return Promise.reject(new Error("Missing read-through function!"));
    return readThrough(key);
  }

  put(key: string, result: BSResult): void {
    // nothing
  }
}
