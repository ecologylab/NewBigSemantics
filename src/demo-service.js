// A demo bigsemantics service

/// <reference path="typings/tsd.d.ts" />

var http = require('http');
var koa = require('koa');

var downloader = require('./downloader');
var pd = require('./phantom-extractor');
var RepoMan = require('./BigSemanticsJavaScript/bsjsCore/RepoMan');
var BigSemantics = require('./BigSemanticsJavaScript/bsjsCore/BigSemantics');

var repoSource = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};
var options = {
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

      startService(bs);
    });
  });
});

// Convert a callback based function / method into a ES6 Promise.
//
// that: the value of 'this' when eventually calling this function / method.
//
// (Function) => Promise
// (Function, Object) => Promise
// (methodName: string, Object) => Promise
function promisify(func, that) {
  if (typeof func == 'function' && (typeof that == 'undefined' || that == null)) {
    that = null;
  } else if (typeof func == 'function' && typeof that == 'object' && that != null) {
    // nothing to do
  } else if (typeof func == 'string' && typeof that == 'object' && that != null) {
    if (typeof that[func] != 'function') {
      throw new Error(methodName + " must be a valid func of 'that'.");
    }
    func = that[func];
  } else {
    throw new Error("Invalid arguments");
  }

  return function() {
    var args = new Array(arguments.length);
    for (var i = 0; i < arguments.length; ++i) { args[i] = arguments[i]; }
    return new Promise(function(resolve, reject) {
      args.push(function(err, result) {
        if (err) { reject(err); return; }
        resolve(result);
      });
      func.apply(that, args);
    });
  }
}

function startService(bs) {
  var app = koa();

  app.use(function*(next) {
    var url = this.query['url'];
    console.log("Received URL: " + url);
    if (url) {
      var options = {};
      var result = yield promisify('loadMetadata', bs)(url, options);
      this.body = result.metadata;
    } else {
      this.throw(400, "Parameter 'url' required.");
    }
  });

  http.createServer(app.callback()).listen(8000);
}

