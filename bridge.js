// Bridge script running inside PhantomJS.

var system = require('system');
var port = system.args[1];
console.log("Port: " + port);

var webpage = require('webpage');
var controlPage = webpage.create();

controlPage.onResourceError = function(error) {
  console.log("Control Page Resource Error: " + error.url);
  console.log("  Reason: " + error.errorCode + " " + error.errorString);
};
 
controlPage.onError = function(msg, trace) {
  console.log("Control Page Error: " + msg);
  if (trace) {
    trace.forEach(function(t) {
      console.log("    " + t.file + ":" + t.line
                  + (t.function ? " (in function '" + t.function + "')" : ""));
    });
  }
};

controlPage.onConsoleMessage = function(msg) {
  console.log("Control Page Msg: " + msg);
};

emit = function(name, msg) {
  controlPage.evaluate(function(name, msg) {
    window.socket.emit(name, msg);
  }, name, msg);
}

var pages = {};

controlPage.onAlert = function(msgStr) {
  console.log("Control Page Alert: " + msgStr);

  var msg = null;
  try {
    msg = JSON.parse(msgStr);
  } catch (error) {
    console.warn("Ignoring unparsable message: " + msgStr);
    return;
  }
  if (!msg.method) {
    console.warn("Method required.");
    return;
  }
  if (!msg.rid || (!msg.pid && msg.method != 'exit')) {
    console.warn("Request ID and Page ID are required.");
    return;
  }

  var resp = { rid: msg.rid, pid: msg.pid };
  if (msg.method == 'createPage') {
    if (!pages[msg.pid]) {
      var page = webpage.create();
      pages[msg.pid] = page;
    } else {
      resp.error = {
        code: 1000,
        message: "Page already created: " + msg.pid
      };
    }
  } else if (msg.method == 'exit') {
    setTimeout(function() { phantom.exit(0); }, 1000);
  } else {
    // page commands
    var page = pages[msg.pid];
    if (!page) {
      resp.error = {
        code: 1001,
        message: "Page not found: " + msg.pid
      };
    } else {
      if (msg.method == 'setContent') {
        page.setContent(msg.params.content, msg.params.url);
      } else if (msg.method == 'evaluate') {
        var args = [];
        var func = null;
        eval("func = " + msg.params.func);
        args.push(func);
        if (msg.params.args) {
          for (var i = 0; i < msg.params.args.length; ++i) {
            args.push(msg.params.args[i]);
          }
        }
        resp.result = page.evaluate.apply(page, args);
      } else if (msg.method == 'close') {
        page.close();
        pages[msg.pid] = undefined;
      }
    }
  }
  emit('response', resp);
};

controlPage.open("http://localhost:8888", function(status) {
  console.log("Control page status: " + status);
});

