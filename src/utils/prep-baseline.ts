// Prepare baseline metadata.

/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="../api/bigsemantics.d.ts" />

import crypto = require('crypto');
import fs = require('fs');
import path = require('path');
import request = require('request');
import base32 = require('base32');

import bigsemantics = require('../../bigsemantics/bsjsCore/base-lib');
import BSPhantom = require('../bs-phantom');

var docUrls = [
  "http://dl.acm.org/citation.cfm?id=1456652&preflayout=flat",
  "http://ieeexplore.ieee.org/xpl/articleDetails.jsp?arnumber=1532126",
  "http://www.google.com/patents/US7953462",
  "http://www.moma.org/collection/works/79211",
  "http://www.nsf.gov/awardsearch/showAward?AWD_ID=0747428",
  "https://twitter.com/nytimes",
  "https://www.google.com/search?tbm=isch&q=exploration",
  "http://www.amazon.com/Nikon-Digital-18-55mm-3-5-5-6G-Focus-S/dp/B00I1CPA0O/",
  "http://en.wikipedia.org/wiki/Velcro",
];

var refresh = false;

var serviceBaseUrl = "http://api.ecologylab.net/BigSemanticsService/metadata.json";

var resultDir = 'result';
if (!fs.existsSync(resultDir)) { fs.mkdir(resultDir); }

function getServiceMetadata(docUrl: string, retry: number, callback: (err, respBody)=>void) {
  var serviceUrl = serviceBaseUrl + "?url=" + encodeURIComponent(docUrl);
  request(serviceUrl, function(err, resp, body) {
    if (err || (resp && resp.statusCode != 200)) {
      if (err) { console.warn("Error for " + docUrl + " : ", err); }
      if (resp) { console.warn("Response for " + docUrl + " : ", resp.statusCode); }
      retry--;
      if (retry > 0) {
        console.log("Retrying ...");
        setTimeout(function() {
          getServiceMetadata(docUrl, retry-1, callback);
        }, 0);
      } else {
        callback(new Error("Failed after retrying: " + docUrl), null);
      }
      return;
    }
    callback(null, body);
  });
}

function saveMetadata(kind: string,
                      docUrl: string,
                      metadata: bigsemantics.Metadata) {
  var typeName = bigsemantics.BSUtils.getType(metadata);
  if (typeName) {
    var digest = base32.encode(crypto.createHash('sha1').update(docUrl).digest());
    var fileName = 'm' + digest.slice(0, 6) + '-' + kind + '-' + typeName + '.json';
    var filePath = path.join(resultDir, fileName);
    var text = JSON.stringify(metadata, null, 2);
    fs.exists(filePath, function(exists) {
      if (refresh || !exists) {
        fs.writeFile(filePath, text, function(err) {
          if (err) {
            console.warn("Failed saving metadata for " + docUrl, err);
            return;
          }
          console.log("Saved metadata for " + docUrl + " to " + filePath);
        });
      }
    });
  } else {
    console.warn("Cannot find type name: ", metadata);
  }

}

function saveServiceMetadata(docUrl: string) {
  getServiceMetadata(docUrl, 5, function(err, respBody) {
    if (err) {
      console.warn("Failed getting service metadata for " + docUrl, err);
      return;
    }

    try {
      var metadata = bigsemantics.BSUtils.unwrap(JSON.parse(respBody));
      saveMetadata('s', docUrl, metadata);
    } catch(exception) {
      console.warn("Failed parsing service metadata for " + docUrl, exception);
      return;
    }
  });
}

function savePhantomMetadata(bs: bigsemantics.IBigSemantics, docUrl: string) {
  bs.loadMetadata(docUrl, null, function(err, result) {
    if (err) {
      console.warn("Failed getting phantom metadata for " + docUrl, err);
      return;
    }

    saveMetadata('p', docUrl, result.metadata);
  });
}

var repoSource = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};
var bs = new BSPhantom(repoSource, null);
bs.onReady(function(err, that) {
  if (err) { console.error(err); return; }
  docUrls.forEach(function(docUrl, index, arr) {
    saveServiceMetadata(docUrl);
    savePhantomMetadata(bs, docUrl);
  });
});

