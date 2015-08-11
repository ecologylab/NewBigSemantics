// Test BSPhantom

import BSPhantom = require('./bs-phantom');

var repoSource: any = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};

var bs = new BSPhantom(repoSource, null);
bs.onReady(function(err, that) {
  if (err) { console.error(err); return; }

  var url = 'http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/';
  bs.loadMetadata(url, null, function(err, result) {
    if (err) { console.error(err); return; }

    console.log("Result: ", result.metadata);
  });
});

