var http = require('http');
import * as koa from 'koa';

var downloader = require('./downloader');
import BSPhantom from './bscore';

var repoSource = {
  url: 'http://api.ecologylab.net/BigSemanticsService/mmdrepository.json'
};

var options = {
  downloader: new downloader.BaseDownloader()
};

var bs = new BSPhantom(repoSource, options);
bs.onReady((err, bs) => {
    console.log("BSPhantom ready");
    startService();    
});

function startService() {
    console.log("Starting service");
    var app = new koa();
    var promiseLoad = promisify('loadMetadata', bs);

    app.use(function*(next) {
        var url = this.query['url'];
        console.log("Received URL: " + url);
        
        if(url) {
            var options = {};
            //var result = yield promisify('loadMetadata', bs);//(url, options);
            var result = yield promiseLoad(url, options);
            this.body = result.metadata;
        } else {
            this.throw(400, "Parameter 'url' required");
        }
    }); 
    
    app.listen(8000);
}

function promisify(func: Function | string, that: Object): (...args: any[])=>Promise<any> {
  var f: Function = null;

  if (typeof func === 'function') {
    f = func;
  } else if (typeof func === 'string' && typeof that === 'object' && that != null) {
    f = that[String(func)];
  }
  if (typeof f != 'function' ) {
    throw new Error("Invalid arguments");
  }

  return function(...args: any[]): Promise<any> {
    return new Promise(function(resolve: Function, reject: Function) {
      var callback = function(err: any, ...results: any[]) {
        if (err) { return reject(err); }
        resolve.apply(that, results);
      };
      args.push(callback);
      f.apply(that, args);
    });
  };
}
