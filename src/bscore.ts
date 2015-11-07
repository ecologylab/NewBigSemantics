// BigSemantics with PhantomJS for extraction.
//
// WIP.

/// <reference path="./api/bigsemantics.d.ts" />

import downloader = require('./downloader');
import pd = require('./phantom-extractor');
import bigsemantics = require('../bigsemantics/bsjsCore/base-lib');

class BSPhantom extends bigsemantics.Readyable implements bigsemantics.IBigSemantics {
  private downloader: bigsemantics.IDownloader;
  private repoMan: bigsemantics.RepoMan;
  private extractor: bigsemantics.IExtractor;
  private bs: bigsemantics.BigSemantics;

  constructor(repoSource: any, options: any) {
    super();
    var that = this;
    if (!options) {
      options = {};
    }
    if (!options.downloader) {
      options.downloader = new downloader.BaseDownloader();
    }
    that.downloader = options.downloader;

    that.repoMan = new bigsemantics.RepoMan(repoSource, options);
    that.repoMan.onReady(function(err, repoMan) {
      if (err) { that.setError(err); return; }

      var host = options.host || 'localhost';
      var port = options.port || 8002;
      pd.createPhantomExtractor(host, port, null, function(err, extractor) {
        if (err) { that.setError(err); return; }

        that.extractor = extractor; 
        options.extractor = extractor;
        options.repoMan = repoMan;
        that.bs = new bigsemantics.BigSemantics(null, options);
        that.bs.onReady(function(err, bs) {
          if (err) { that.setError(err); return; }

          that.setReady();
        });
      });
    });
  }

  loadMetadata(location, options, callback) {
    this.bs.loadMetadata(location, options, callback);
  }

  loadInitialMetadata(location, options, callback) {
    this.bs.loadInitialMetadata(location, options, callback);
  }

  loadMmd(name, options, callback) {
    this.bs.loadMmd(name, options, callback);
  }

  selectMmd(location, options, callback) {
    this.bs.selectMmd(location, options, callback);
  }

}

export = BSPhantom;

