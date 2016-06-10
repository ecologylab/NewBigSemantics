// Test BSPhantom

import BSPhantom from './bscore'; //= require('./bscore');

var repoSource: any = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};

var options = { host: 'http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/' }
var bs = new BSPhantom(repoSource, null);
bs.onReady((err, that) => {
  if (err) { console.error(err); return; }
  
  bs.loadMetadata(options.host, null, function(err, result) {
    if (err) { console.error(err); return; }

    console.log("Result: ", JSON.stringify(result.metadata));
  });
});;
