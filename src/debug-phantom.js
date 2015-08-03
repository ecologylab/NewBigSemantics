// For debugging PhantomJS.

var webpage = require('webpage');

var page = webpage.create();

var verbose = true;
if (verbose) {
  page.onResourceRequested = function(request) {
    console.log(">> Resource requested: ", request.url);
  };
   
  page.onResourceReceived = function(response) {
    console.log(">> Resource received: ", response.url);
  };
   
  page.onLoadStarted = function() {
    var currentUrl = page.evaluate(function() {
        return window.location.href;
    });
    console.log(">> Load started; leaving ", currentUrl);
  };
   
  page.onLoadFinished = function(status) {
    console.log(">> Load finished; status: ", status);
  };
   
  page.onNavigationRequested = function(url, type, willNavigate, main) {
    console.log(">> Navigation to ", url, " requested, type: ", type, ", will navigate: ", willNavigate);
  };
}

page.onResourceError = function(resourceError) {
  console.warn("!! Resource error: ", resourceError);
};
 
page.onError = function(msg, trace) {
  var msgStack = ["!! Error: " + msg];
  if (trace) {
    msgStack.push("    Trace:");
    trace.forEach(function(t) {
      msgStack.push("        -> " + t.file + ": " + t.line +
                    (t.function ? " (in function '" + t.function + "')" : ""));
    });
  }
  console.log(msgStack.join('\n'));
};

function debugSetContent() {
  var bsjsFiles = [
    './BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js',
    './BigSemanticsJavaScript/bsjsCore/BSUtils.js',
    './BigSemanticsJavaScript/bsjsCore/FieldOps.js',
    './BigSemanticsJavaScript/bsjsCore/FieldParsers.js',
    './BigSemanticsJavaScript/bsjsCore/Extractor.js'
  ];

  var fs = require('fs');
  var msgStr = fs.read('test1.json', { mode: 'r', charset: 'UTF-8' });
  var msg = JSON.parse(msgStr);
  var content = msg.params.content;
  var smmd = fs.read('amazon.json', { mode: 'r', charset: 'UTF-8' });
  var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";
  page.setContent(content, url);
  page.onLoadFinished = function() {
    var n = bsjsFiles.length;
    for (var i in bsjsFiles) {
      if (!page.injectJs(bsjsFiles[i])) {
        console.warn("!! Failed to inject ", bsjsFiles[i]);
        continue;
      }
      n--;
      if (n == 0) {
        var metadata = page.evaluate(function(smmd) {
          var mmd = simpl.deserialize(smmd);
          if (mmd['meta_metadata'] && mmd['meta_metadata']['name']) {
            mmd = mmd['meta_metadata'];
          }
          var resp = { entity: document, location: document.location.href };
          var metadata = extractMetadataSync(resp, mmd, null, null);
          return metadata;
        }, smmd);
        console.log("@@@@@@@@@ Result: ", JSON.stringify(metadata));
        phantom.exit(0);
      }
    }
    page.onLoadFinished = null;
  };
}

debugSetContent();

