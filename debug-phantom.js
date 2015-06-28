// For debugging PhantomJS page loading.

var system = require('system');
var webpage = require('webpage');
var page = webpage.create();

var verbose = false;
var url = "about:blank";

if (system.args.length <= 1) {
  console.log("usage: phantomjs " + system.args[0] + " <options> <url>");
  console.log("  options:");
  console.log("  -v  verbose");
  phantom.exit(1);
}

for (var i = 1; i < system.args.length; ++i) {
  var arg = system.args[i];
  if (arg[0] == '-') {
    if (arg == '-v') {
      verbose = true;
    } else {
      console.log("ignoring option " + arg);
    }
  } else {
    url = arg;
    console.log("URL: " + url);
  }
}

if (verbose) {
  page.onResourceRequested = function (request) {
    system.stderr.writeLine('= onResourceRequested()');
    system.stderr.writeLine('  request: ' + JSON.stringify(request, undefined, 4));
  };
   
  page.onResourceReceived = function(response) {
    system.stderr.writeLine('= onResourceReceived()' );
    system.stderr.writeLine('  id: ' + response.id + ', stage: "' + response.stage + '", response: ' + JSON.stringify(response));
  };
   
  page.onLoadStarted = function() {
    system.stderr.writeLine('= onLoadStarted()');
    var currentUrl = page.evaluate(function() {
        return window.location.href;
    });
    system.stderr.writeLine('  leaving url: ' + currentUrl);
  };
   
  page.onLoadFinished = function(status) {
    system.stderr.writeLine('= onLoadFinished()');
    system.stderr.writeLine('  status: ' + status);
  };
   
  page.onNavigationRequested = function(url, type, willNavigate, main) {
    system.stderr.writeLine('= onNavigationRequested');
    system.stderr.writeLine('  destination_url: ' + url);
    system.stderr.writeLine('  type (cause): ' + type);
    system.stderr.writeLine('  will navigate: ' + willNavigate);
    system.stderr.writeLine('  from page\'s main frame: ' + main);
  };

}

page.onResourceError = function(resourceError) {
  system.stderr.writeLine('= onResourceError()');
  system.stderr.writeLine('  - unable to load url: "' + resourceError.url + '"');
  system.stderr.writeLine('  - error code: ' + resourceError.errorCode + ', description: ' + resourceError.errorString );
};
 
page.onError = function(msg, trace) {
  system.stderr.writeLine('= onError()');
  var msgStack = ['  ERROR: ' + msg];
  if (trace) {
      msgStack.push('  TRACE:');
      trace.forEach(function(t) {
          msgStack.push('    -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
      });
  }
  system.stderr.writeLine(msgStack.join('\n'));
};

page.open(url, function(status) {
  console.log("status: " + status);
  setTimeout(function() { phantom.exit(0); }, 1000);
});

