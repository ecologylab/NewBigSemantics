// A very first test of the new BigSemantics.

import bigsemantics = require('./bigsemantics');

var paperUrl = 'http://dl.acm.org/citation.cfm?id=2557083';
bigsemantics.getMetadata(paperUrl, function(error, paper) {
  if (error) {
    console.log("Error: " + error);
  } else {
    var paperJson = bigsemantics.serialize(paper);
    console.log(paperJson);
  }
});

