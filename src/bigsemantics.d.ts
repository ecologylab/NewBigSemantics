// Type declarations of BigSemantics JS.

declare module 'bigsemantics' {

  export interface MetaMetadata {
    name: string;
  }

  export interface Metadata {
    mm_name: string;
  }

  export interface Readyable {
    isReady(): boolean;
    onReady(callback: (err: any, that: Readyable)=>void): void;
    setReady(): void;
    setError(err: any): void;
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

}

