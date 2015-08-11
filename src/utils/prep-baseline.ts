// Prepare baseline metadata.

/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="../api/bigsemantics.d.ts" />

import crypto = require('crypto');
import fs = require('fs');
import request = require('request');

import bigsemantics = require('../../bigsemantics/bsjsCore/base-lib');

var docUrls = [
  "http://dl.acm.org/citation.cfm?id=1456652&preflayout=flat",
  "http://ieeexplore.ieee.org/xpl/articleDetails.jsp?arnumber=1532126",
  "http://www.google.com/patents/US7953462",
  // "http://www.moma.org/collection/works/79211",
  "http://www.nsf.gov/awardsearch/showAward?AWD_ID=0747428",
  // "https://www.google.com/search?tbm=isch&q=exploration",
  "http://www.amazon.com/Nikon-Digital-18-55mm-3-5-5-6G-Focus-S/dp/B00I1CPA0O/",
  "http://en.wikipedia.org/wiki/Velcro",
];

var serviceBaseUrl = "http://api.ecologylab.net/BigSemanticsService/metadata.json";

var refresh = false;

function getRawMetadata(docUrl: string, retry: number, callback: (err, respBody)=>void) {
  var serviceUrl = serviceBaseUrl + "?url=" + encodeURIComponent(docUrl);
  request(serviceUrl, function(err, resp, body) {
    if (err || (resp && resp.statusCode != 200)) {
      if (err) { console.warn("Error for " + docUrl + " : ", err); }
      if (resp) { console.warn("Response for " + docUrl + " : ", resp.statusCode); }
      retry--;
      if (retry > 0) {
        console.log("Retrying ...");
        setTimeout(function() {
          getRawMetadata(docUrl, retry-1, callback);
        }, 0);
      } else {
        callback(new Error("Failed after retrying: " + docUrl), null);
      }
      return;
    }
    callback(null, body);
  });
}

function saveRawMetadata(docUrl: string) {
  getRawMetadata(docUrl, 5, function(err, respBody) {
    if (err) {
      console.warn("Failed saving raw metadata for " + docUrl, err);
      return;
    }

    try {
      var metadata = bigsemantics.BSUtils.unwrap(JSON.parse(respBody));
    } catch(exception) {
      console.warn("Failed parsing metadata for " + docUrl, exception);
      return;
    }

    var typeName = bigsemantics.BSUtils.getType(metadata);
    if (typeName) {
      var digest = crypto.createHash('sha1').update(docUrl).digest('hex');
      var fileName = "m-" + typeName + "-" + digest.slice(0, 3) + ".json";
      fs.exists(fileName, function(exists) {
        if (refresh || !exists) {
          fs.writeFile(fileName, respBody, function(err) {
            if (err) {
              console.warn("Failed saving raw metadata for " + docUrl, err);
              return;
            }
            console.log("Saved raw metadata for " + docUrl + " to " + fileName);
          });
        }
      });
    } else {
      console.warn("Cannot find type name: ", metadata);
    }
  });
}

docUrls.forEach(function(docUrl, index, arr) {
  saveRawMetadata(docUrl);
});

