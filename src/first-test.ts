// A very first test of the new BigSemantics.

/// <reference path="./api/bigsemantics.d.ts" />

import downloader = require('./downloader');
import pd = require('./phantom-extractor');
import RepoMan = require('../bigsemantics/bsjsCore/RepoMan');
import BigSemantics = require('../bigsemantics/bsjsCore/BigSemantics');

var url = 'http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/';

var repoSource: any = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};
var options: any = {
  downloader: new downloader.BaseDownloader()
};

var repoMan = new RepoMan(repoSource, options);
repoMan.onReady(function(err, repoMan) {
  if (err) { console.error(err); return; }

  pd.createPhantomExtractor('localhost', 8880, null, function(err, extractor) {
    options.extractor = extractor;
    options.repoMan = repoMan;

    var bs = new BigSemantics(null, options);
    bs.onReady(function(err, bs) {
      if (err) { console.error(err); return; }

      bs.loadMetadata(url, null, function(err, result) {
        if (err) { console.error(err); return; }

        console.log("Result: ", result.metadata);
      });
    });
  });
});

