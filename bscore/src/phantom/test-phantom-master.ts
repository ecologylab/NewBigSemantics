// Testing Phantomteer

import cp = require('child_process');
import pm = require('./phantom-master');
import downloader = require('../downloader');

function doWithPage(host: string,
                    port: number,
                    options: Object,
                    callback: (err: any, page: pm.Page, end: ()=>void)=>void) {
  pm.createMaster(host, port, options, function(err, master) {
    if (err) { callback(err, null, null); return; }

    var args = [ 'phantom-bridge.js', host, String(port) ];
    var phantom = cp.spawn('phantomjs', args);
    phantom.stdout.on('data', function(data) {
      console.log("PHANTOM INFO: " + data.toString());
    });
    phantom.stderr.on('data', function(data) {
      console.warn("PHANTOM ERROR: " + data.toString());
    });
    phantom.on('error', function(err) {
      console.warn("ERROR: PHANTOM: " + err);
    });
    phantom.on('exit', function (code, signal) {
      console.log("INFO: Phantom exitted with code " + code
                  + (signal?(", signal: " + signal):("")));
    });

    var masterStarted = false;
    master.on('connection', function() {
      if (masterStarted) { return; }
      masterStarted = true;

      master.createPage(function(err, page) {
        if (err) { return callback(err, null, null); }

        callback(null, page, function() {
          page.close(function(err) {
            if (err) { return console.error("Failed to close page!"); }

            console.log("Page closed.");
            master.exit(function(err) {
              if (err) { return console.error("Failed to exit phantom!"); }

              console.log("Phantom exited.");
              master.shutdown();
            });
          });
        });
      });
    });
  });
}

function test1() {
  doWithPage('localhost', 8888, null, function(err, page, end) {
    if (err) { console.error(err); return; }

    var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";
    var xpath = "//title";
    var func = function(xpath) {
      var result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
      return result.stringValue;
    };

    page.open(url, null, function(err) {
      if (err) { console.error("Failed to set content!"); return end(); }

      page.evaluate(func, xpath, function(err, result) {
        if (err) { console.error("Failed to run function!"); return end(); }

        console.log("Result: %j", result);
        end();
      });
    });
  });
}

declare var extractMetadataSync: (resp, mmd, bs, options)=>void;
declare var simpl: {
  serialize(obj: Object): string;
  deserialize(serial: string): Object
};
function test2() {
  var jsFiles = [
    'BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js',
    'BigSemanticsJavaScript/bsjsCore/BSUtils.js',
    'BigSemanticsJavaScript/bsjsCore/FieldOps.js',
    'BigSemanticsJavaScript/bsjsCore/FieldParsers.js',
    'BigSemanticsJavaScript/bsjsCore/Extractor.js'
  ];
  var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";
  var mmdUrl = 'http://api.ecologylab.net/BigSemanticsService/mmd.json?name=amazon_product';
  var d = new downloader.BaseDownloader();
  d.httpGet(mmdUrl, null, function(err, resp) {
    if (err) { return console.error(err); }

    var smmd = resp.text;

    doWithPage('localhost', 8888, null, function(err, page, end) {
      if (err) { return console.error(err); }

      page.open(url, null, function(err) {
        if (err) { console.error(err); return end(); }

        var toInject = jsFiles.length;
        for (var jsFile of jsFiles) {
          page.injectJs(jsFile, function(err, result) {
            toInject--;
            if (err) { return console.error(err); }
            if (result === false) { return console.error("Failed to inject " + jsFile); }

            if (toInject === 0) {
              var func = function(smmd): any {
                var mmd = simpl.deserialize(smmd)['meta_metadata'];
                var resp = {
                  entity: document,
                  location: document.location.href,
                };
                var metadata = extractMetadataSync(resp, mmd, null, null);
                return metadata;
              };
              page.evaluate(func, smmd, function(err, result) {
                if (err) { console.error(err); return end(); }
                console.log("Result: %j", result);
                end();
              });
            }
          });
        }
      });
    });
  });
}

function test3() {
  var jsFiles = [
    'BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js',
    'BigSemanticsJavaScript/bsjsCore/BSUtils.js',
    'BigSemanticsJavaScript/bsjsCore/FieldOps.js',
    'BigSemanticsJavaScript/bsjsCore/FieldParsers.js',
    'BigSemanticsJavaScript/bsjsCore/Extractor.js'
  ];
  var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";
  var mmdUrl = 'http://api.ecologylab.net/BigSemanticsService/mmd.json?name=amazon_product';
  var d = new downloader.BaseDownloader();
  d.httpGet(mmdUrl, null, function(err, resp) {
    if (err) { return console.error(err); }

    var smmd = resp.text;

    doWithPage('localhost', 8888, null, function(err, page, end) {
      if (err) { return console.error(err); }

      page.open(url, null, function(err) {
        if (err) { console.error(err); return end(); }

        var toInject = jsFiles.length;
        for (var jsFile of jsFiles) {
          page.injectJs(jsFile, function(err, result) {
            toInject--;
            if (err) { return console.error(err); }
            if (result == false) { return console.error("Failed to inject " + jsFile); }

            if (toInject == 0) {
              var func = function(smmd): any {
                var mmd = simpl.deserialize(smmd)['meta_metadata'];
                var resp = {
                  entity: document,
                  location: document.location.href
                };
                var metadata = extractMetadataSync(resp, mmd, null, null);
                return metadata;
              };
              page.evaluate(func, smmd, function(err, result) {
                if (err) { console.error(err); return end(); }
                console.log("Result: %j", result);
                end();
              });
            }
          });
        }
      });
    });
  });
}

test1();
