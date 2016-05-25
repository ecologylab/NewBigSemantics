// Test PhantomJS master.

/// <reference path="../../bigsemantics/bsjsCore/simpl/simplBase.d.ts" />
/// <reference path="../../bigsemantics/bsjsCore/bstypes.d.ts" />

import { Master, Page } from './master';
import { BaseDownloader } from '../downloader';

function test1() {
  var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";

  var master = new Master();
  var page = master.open(url);
  page
    .evaluate(xpath => {
      var result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
      return result.stringValue;
    }, "//title")
    .then(result => console.log(result))
    .error(err => console.error(err)); 
  page.close()
    .then(result => console.log("page closed"))
    .error(err => console.error(err));
}

declare var extractMetadataSync: (resp, mmd, bs, options)=>void;

function test2() {
  var scripts = [
    "../../../bigsemantics/bsjsCore/simpl/simplBase.js",
    "../../../bigsemantics/bsjsCore/BSUtils.js",
    "../../../bigsemantics/bsjsCore/FieldOps.js",
    "../../../bigsemantics/bsjsCore/FieldParsers.js",
    "../../../bigsemantics/bsjsCore/Extractor.js",
  ];

  var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";
  var mmdUrl = 'http://api.ecologylab.net/BigSemanticsService/mmd.json?name=amazon_product';

  var d = new downloader.BaseDownloader();
  d.httpGet(mmdUrl, null, function(err, resp) {
    if (err) { return console.error(err); }

    var smmd = resp.text;

    var master = new Master();
    var page = master.open(url);
    page
      .injectJs(scripts)
      .evaluate(smmd => {
        var mmd = simpl.deserialize(smmd)['meta_metadata'];
        var resp = {
          entity: document,
          location: document.location.href,
        };
        var metadata = extractMetadataSync(resp, mmd, null, null);
        return metadata;
      }, smmd)
      .then(result => console.log(result))
      .error(err => console.error(err));
    page.close()
      .then(result => console.log("page closed."))
      .error(err => console.error(err));
  });
}

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

