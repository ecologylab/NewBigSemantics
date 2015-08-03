// A very first test of the new BigSemantics.

/// <reference path="./api/bigsemantics.d.ts" />

import downloader = require('./downloader');
import pd = require('./phantom-extractor');
import RepoMan = require('./BigSemanticsJavaScript/bsjsCore/RepoMan');
import BigSemantics = require('./BigSemanticsJavaScript/bsjsCore/BigSemantics');

var url = 'http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/';

var repoMan = new RepoMan({
  file: './BigSemanticsJavaScript/bsjsCore/simpl/test/testRepo.json'
});
repoMan.onReady(function(err, repoMan) {
  if (err) { console.error(err); return; }

  pd.createPhantomExtractor('localhost', 8880, null, function(err, extractor) {
    var options = {
      downloader: new downloader.BaseDownloader(),
      extractor: extractor,
      repoMan: repoMan
    };

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

