// Testing Phantomteer

import ph = require('./phantomteer');

var html = "<html><head><title>hello world</title></head><body>this is the body</body></html>";
var url = "about:test";
var xpath = "//title";

var func = function(xpath) {
  var result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
  return result.stringValue;
};

var host = 'localhost';
var port = 8888;

ph.createController(host, port, null, function(err, controller) {
  if (err) { console.error("Failed to create controller!"); return; }

  ph.spawnPhantom(host, port, null, function(err, phantom) {
    if (err) { console.error("Failed to spawn phantom!"); return; }

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
      if (err) { console.error("Failed to create page!"); return; }

      console.log("Page created, id = " + page.getId());
      page.setContent(html, url, function(err) {
        if (err) { console.error("Failed to set content!"); return; }

        console.log("Content set.");
        page.evaluate(func, xpath, function(err, result) {
          if (err) { console.error("Failed to evaluate function!"); return; }

          console.log("Extracted scalar: " + result);
          page.close(function(err) {
            if (err) { console.error("Failed to close page!"); return; }

            console.log("Page closed.");
            controller.exit(function(err) {
              if (err) { console.error("Failed to exit phantom!"); return; }

              console.log("Phantom exitted.");
              controller.shutdown();
            });
          });
        });
      });
    });
  });
});

