// Type declarations of BigSemantics JS.

declare namespace bigsemantics {

  export class ParsedURL {
    raw: string;
    stripped: string;

    scheme: string;
    hostSpec: string; // [user:pass@host:port]
    user: string;
    password: string;
    host: string;
    port: number;

    domain: string; // top level domain
    path: string;
    query: Object; // param key-value pairs
    fragmentId: string;

    constructor(rawUrl: string);
  }

  export interface MetaMetadata {
    name: string;
  }

  export interface Metadata {
    mm_name: string;
  }

  export class Readyable {
    isReady(): boolean;
    onReady(callback: (err: any, that: Readyable)=>void): void;
    setReady(): void;
    setError(err: any): void;
  }

  export interface Response {
    location: string;
    otherLocations?: Array<string>;

    code: number;
    contentType?: string;
    charset?: string;

    entity?: Object;
    xml?: Object;
    text?: string;
  }

  export interface IDownloader {
    httpGet(
      location: string,
      options: Object,
      callback: (err: any, resp: Response)=>void
    ): void;
  }

  export interface IExtractor {
    (response: Response,
     mmd: MetaMetadata,
     bigSemantics: IBigSemantics,
     options: Object,
     callback: (err: any, metadata: Metadata)=>void): void;
  }

  export interface IExtractorSync {
    (response: Response,
     mmd: MetaMetadata,
     bigSemantics: IBigSemantics,
     options: Object): Metadata;
  }

  var extractMetadata: IExtractor;

  export class RepoMan extends Readyable {
    loadMmd(
      name: string,
      options: any,
      callback: (err: any, mmd: MetaMetadata)=>void
    ): void;

    selectMmd(
      location: string,
      options: any,
      callback: (err: any, mmd: MetaMetadata)=>void
    ): void;
  }

  export interface IBigSemantics {
    loadMetadata(
      location: string,
      options: any,
      callback: (err: any, result: {metadata: Metadata, mmd: MetaMetadata})=>void
    ): void;

    loadInitialMetadata(
      location: string,
      options: any,
      callback: (err: any, initialMetadata: Metadata)=>void
    ): void;

    loadMmd(
      name: string,
      options: any,
      callback: (err: any, mmd: MetaMetadata)=>void
    ): void;

    selectMmd(
      location: string,
      options: any,
      callback: (err: any, mmd: MetaMetadata)=>void
    ): void;
  }

  export class BigSemantics extends Readyable implements IBigSemantics {
    loadMetadata(location, options, callback);
    loadInitialMetadata(location, options, callback);
    loadMmd(name, options, callback);
    selectMmd(location, options, callback);
  }

}

declare module 'bigsemantics' {
  export = bigsemantics;
}

