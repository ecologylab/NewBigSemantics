// A demo bigsemantics service

var http = require('http');
var koa = require('koa');

var downloader = require('./downloader');
var pd = require('./phantom-extractor');
var RepoMan = require('../bigsemantics/bsjsCore/RepoMan');
var BigSemantics = require('../bigsemantics/bsjsCore/BigSemantics');

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
// @arg func:
//   The function, or the name of a method on that.
//   The last arg to func is expected to be a callback.
//   The first arg to the callback is expected to be the error (can be null).
//
// @arg that:
//   The value of 'this' when eventually calling this function / method.
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
    for (var i = 0; i < arguments.length; ++i) {
      args[i] = arguments[i];
    }
    return new Promise(function(resolve, reject) {
      var callback = function() {
        if (arguments.length > 0) {
          var err = arguments[0];
          if (typeof err != 'undefined' && err != null) {
            reject(err);
            return;
          }
          var results = new Array(arguments.length - 1);
          for (var j = 1; j < arguments.length; ++j) {
            results[j-1] = arguments[j];
          }
          if (results.length == 0) {
            resolve();
          } else if (results.length == 1) {
            resolve(results[0]);
          } else {
            resolve(results);
          }
          return;
        }
        resolve();
      };
      args.push(callback);
      func.apply(that, args);
    });
  };
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

