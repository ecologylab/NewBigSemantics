// Repository Manager (RepoMan) API.

/// <reference path='base.ts' />

interface RepoSource
{
  url?: string; // '?' means optional
  file?: string;
}

// A callback function signature declaration to make the compiler happy
interface RepoReadyCallback
{
  (err: Error, repoMan: RepoMan): void;
}

class RepoMan
{

  private ready: boolean = false;
  private queue: Array<RepoReadyCallback> = [];
  
  private mmds: MetaMetadataMap;

  constructor(source: RepoSource, options: any)
  {
    // TODO load repo to this.mmds via HTTP or disk I/O ...
    //
    // in the callback when the I/O finishes:
    // - build all the maps we need
    // - set ready to true
    // - processCallbacks(null, this);
    //
    // if error happens: processCallbacks(err, null);
  }

  isReady(): boolean { return this.ready; }

  onReady(callback: (err, repoMan)=>void)
  {
    if (this.isReady()) { callback(null, this); }
    else { this.queue.push(callback); }
  }

  private processCallbacks(err: Error, repoMan: RepoMan)
  {
    this.queue.forEach(function(f) { f(err, repoMan); });
    this.queue = [];
  }

  loadMmd(name: string,
          options: any,
          callback: (err: Error, mmd: MetaMetadata)=>void): void
  {
    if (!this.isReady())
    {
      callback(new Error("RepoMan is not ready!"), null);
      return;
    }
    callback(null, this.mmds[name]);
  }

  // Get MMD by URL.
  selectMmd(location: string,
            options: any,
            callback: (err: Error, mmd: MetaMetadata)=>void): void
  {
    if (!this.isReady())
    {
      callback(new Error("RepoMan is not ready!"), null);
      return;
    }

    // selector logic here ...
    // perhaps change type based on content (passed in via options) ...

    callback(null, { name: 'undefined' }); // TODO replace with real result
  }

  // Returns a canonical form of the input location, using filters defined in
  // the repository.
  canonicalizeLocation(location: string,
                       options: any,
                       callback: (err: Error, mmd: string)=>void): void
  {
    if (!this.isReady())
    {
      callback(new Error("RepoMan is not ready!"), null);
      return;
    }

    // implementation ...

    callback(null, ''); // TODO replace with real result
  }

}

