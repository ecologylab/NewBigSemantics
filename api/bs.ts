// BigSemantics facet.

/// <reference path='base.ts' />
/// <reference path='repoMan.ts' />
/// <reference path='downloader.ts' />
/// <reference path='extractor.ts' />

// interfaces are just type declarations for the TypeScript compiler

interface IBigSemantics
{

  // Load metadata for a given location. Call the callback when finished.
  //
  // @param location: (obvious)
  // @param options:
  //   We can put misc options, like 'forceService' or 'reload', in this object,
  //   to improve readability.
  // @param callback:
  //   Callback function that accepts two args and returns nothing.
  //   Arg 1: error object. can have error message and extra information.
  //          null if everything worked fine.
  //   Arg 2: metadata object, **recursively joined with corresponding mmd**.
  //
  // @return: nothing (void).
  loadMetadata(
    location: string,
    options: any,
    callback: (err: Error, metadata: Metadata)=>void
  ): void;
  
  // Load mmd for a given name. Call the callback when finished.
  loadMmd(
    name: string,
    options: any,
    callback: (err: Error, mmd: MetaMetadata)=>void
  ): void;

  // Select mmd for a given location. Call the callback when finished.
  selectMmd(
    location: string,
    options: any,
    callback: (err: Error, mmd: MetaMetadata)=>void
  ): void;

  // Return the form of location after filtered by corresponding mmd.
  canonicalizeLocation(
    location: string,
    options: any,
    callback: (err, Error, canonLocation: string)=>void
  ): void;

}

// A callback function signature declaration to make the compiler happy
interface BSReadyCallback
{
  (err: Error, bs: BigSemantics): void;
}

class BigSemantics implements IBigSemantics
{

  private ready: boolean = false;
  private queue: Array<BSReadyCallback> = [];

  private repoMan: RepoMan;
  private downloader: Downloader;
  private extractor: Extractor;

  constructor(private repoSource: RepoSource)
  {
    var self = this;
    self.repoMan = new RepoMan(repoSource, null);
    self.repoMan.onReady(function(err, repo) {
      if (err) { self.processCallbacks(err, null); return; }

      self.downloader = new Downloader({
        domainIntervals: self.repoMan['domainIntervals']
      });
      self.extractor = extract;

      self.ready = true;
      self.processCallbacks(null, self);
    });;
  }

  isReady(): boolean { return this.ready; }

  onReady(callback: BSReadyCallback): void
  {
    if (this.isReady()) { callback(null, this); }
    else { this.queue.push(callback); }
  }

  private processCallbacks(err: Error, bs: BigSemantics)
  {
    this.queue.forEach(function(f) { f(err, bs); });
    this.queue = [];
  }

  loadMetadata(location, options, callback)
  {
    if (!this.isReady())
    {
      callback(new Error("BigSemantics is not ready!"), null);
      return;
    }

    var self = this;
    self.downloader.httpGet(location, null, function(err, response) {
      if (err) { callback(err, null); return; }

      var mmdOpts = { page: response.page };
      self.repoMan.selectMmd(response.location, mmdOpts, function(err, mmd) {
        if (err) { callback(err, null); return; }

        var metadata = self.extractor(response, mmd, self.repoMan);
        callback(null, metadata);
      });
    });
  }
  
  loadMmd(name, options, callback)
  {
    this.repoMan.loadMmd(name, options, callback);
  }

  selectMmd(location, options, callback)
  {
    this.repoMan.selectMmd(location, options, callback);
  }
  
  canonicalizeLocation(location, options, callback)
  {
    this.repoMan.canonicalizeLocation(location, options, callback);
  }

}

