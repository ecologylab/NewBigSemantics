// Prepare baseline metadata.
import crypto = require('crypto');
import fs = require('fs');
import path = require('path');
import request = require('request');

import ParsedURL from '../../BigSemanticsJavaScript/bsjsCore/ParsedURL';
import Readyable = require('../../BigSemanticsJavaScript/bsjsCore/Readyable');
import RepoMan from '../../BigSemanticsJavaScript/bsjsCore/RepoMan';
import BigSemantics from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import BSUtils from '../../BigSemanticsJavaScript/bsjsCore/BSUtils';
import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';
import Downloader from '../../BigSemanticsJavaScript/bsjsCore/Downloader';

import * as pm from '../phantom/master';

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
                      metadata: any) {
  var typeName = BSUtils.getType(metadata);
  if (typeName) {
    var digest = new ParsedURL(docUrl).domain;
    //var digest = base32.encode(crypto.createHash('sha1').update(docUrl).digest());
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
      var metadata = BSUtils.unwrap(JSON.parse(respBody));
      saveMetadata('s', docUrl, metadata);
    } catch(exception) {
      console.warn("Failed parsing service metadata for " + docUrl, exception);
      return;
    }
  });
}

function savePhantomMetadata(bs: BigSemantics, docUrl: string) {
  bs.loadMetadata(docUrl, options, function(err, result) {
    if (err) {
      console.warn("Failed getting phantom metadata for " + docUrl, err);
      return;
    }

    var metadata = BSUtils.unwrap(result.metadata);
    saveMetadata('p', docUrl, metadata);
  });
}

var repoSource = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};

// Required so that TypeScript won't complain about this not existing
declare var extractMetadata;
declare var respond: (err: any, result: any) => void;

function createExtractor() {
  var extractor = function (resp, mmd, bigSemantics, options, mcallback: (err: any, result: string | Object) => void) {
    var agent = master.randomAgent();
    var page = agent.createPage();
    var smmd = simpl.serialize(mmd);

    var clientScripts = [
      '../../BigSemanticsJavascript/bsjsCore/simpl/simplBase.js',
      '../../BigSemanticsJavascript/bsjsCore/BSUtils.js',
      '../../BigSemanticsJavascript/bsjsCore/FieldOps.js',
      '../../BigSemanticsJavascript/bsjsCore/Extractor.js',
    ];

    page.open(resp.location)
      .injectJs(clientScripts)
      .evaluateAsync((smmd) => {
        var mmd = simpl.deserialize(smmd);
        if ('meta_metadata' in mmd
          && mmd['meta_metadata']
          && mmd['meta_metadata']['name']) {
          mmd = mmd['meta_metadata'];
        }

        var resp = {
          code: 200,
          entity: document,
          location: document.location.href
        };

        extractMetadata(resp, mmd, null, null, function(err, metadata) {
          respond(err, JSON.stringify(metadata));  
        });
      }, smmd)
      .then(result => mcallback(null, JSON.parse(result)))
      .close()
      .catch(err => console.error("ERROR: ", err))
      //.finally(() => master.shutdown());
  }
  
  return extractor;
}

var options = {
  downloader: new Downloader(),
  extractor: null,
  repoMan: null,
  page: 1
}

var master = new pm.Master();
var repoMan = new RepoMan({ url: repoSource.url }, options);

repoMan.onReady((err, repoMan) => {
  if(err) { console.error(err); return; }
  console.log("RepoMan ready");
  
  options.repoMan = repoMan;
  options.extractor = createExtractor();
  
  var bs = new BigSemantics(null, options);
  bs.onReady((err, bs) => {
    if (err) { console.error(err); return; }
    docUrls.forEach(function(docUrl, index, arr) {
      saveServiceMetadata(docUrl);
      savePhantomMetadata(bs, docUrl);
    });
  });
});
