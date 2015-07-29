// Testing Phantomteer

import * as ph from './phantomteer';
import * as downloader from './downloader';

function doWithPage(host: string,
                    port: number,
                    options: Object,
                    callback: (err, page: ph.Page, end: ()=>void)=>void) {
  ph.createController(host, port, options, function(err, controller) {
    if (err) { callback(err, null, null); return; }

    ph.spawnPhantom(host, port, options, function(err, phantom) {
      if (err) { callback(err, null, null); return; }

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

      controller.createPage(function(err, page) {
        if (err) { callback(err, null, null); return; }

        callback(null, page, function() {
          page.close(function(err) {
            if (err) { console.error("Failed to close page!"); return; }

            console.log("Page closed.");
            controller.exit(function(err) {
              if (err) { console.error("Failed to exit phantom!"); return; }

              console.log("Phantom exited.");
              controller.shutdown();
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
      if (err) { console.error("Failed to set content!"); end(); return; }

      page.evaluate(func, xpath, function(err, result) {
        if (err) { console.error("Failed to run function!"); end(); return; }

        console.log("Result: ", result);
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
    if (err) { console.error(err); return; }

    var smmd = resp.text;

    doWithPage('localhost', 8888, null, function(err, page, end) {
      if (err) { console.error(err); return; }

      page.open(url, null, function(err) {
        if (err) { console.error(err); end(); return; }

        var toInject = jsFiles.length;
        for (var jsFile of jsFiles) {
          page.injectJs(jsFile, function(err, result) {
            if (err) { console.error(err); end(); return; }
            if (result == false) { console.error("Failed to inject " + jsFile); return; }

            toInject--;
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
                if (err) { console.error(err); end(); return; }
                console.log("Result: ", result);
                end();
              });
            }
          });
        }
      });
    });
  });
}

test2();

