// Bridge script running inside PhantomJS.

declare var phantom: any; // to make TS compiler happy

var system = require('system');
var host = system.args[1];
var port = system.args[2];
console.log("Host: " + host);
console.log("Port: " + port);

var webpage = require('webpage');
var controlPage = webpage.create();

controlPage.onResourceError = function(error) {
  // TODO send message back to controller
  console.warn("Control Page Resource Error: ", error);
};
 
controlPage.onError = function(msg, trace) {
  // TODO send message back to controller
  console.warn("Control Page Error: ", msg);
  if (trace) {
    trace.forEach(function(t) {
      console.warn("    " + t.file + ":" + t.line
                   + (t.function ? " (in function '" + t.function + "')" : ""));
    });
  }
};

controlPage.onConsoleMessage = function(msg) {
  // TODO send message back to controller
  console.log("Control Page Message: ", msg);
};

var emit = function(name, msg) {
  controlPage.evaluate(function(name, msg) {
    window['socket'].emit(name, msg);
  }, name, msg);
}

var pages = {};

controlPage.onAlert = function(msgStr) {
  console.log("Control Page Alert: ", msgStr);

  var msg = null;
  try {
    msg = JSON.parse(msgStr);
  } catch (error) {
    console.warn("Ignoring unparsable message: ", msgStr);
    return;
  }
  if (!msg.method) {
    console.warn("Method required: ", msgStr);
    return;
  }
  if (!msg.id || (!msg.pageId && msg.method != 'exit')) {
    console.warn("Request ID and Page ID required: ", msgStr);
    return;
  }

  var resp: any = { id: msg.id, pageId: msg.pageId };
  if (msg.method == 'createPage') {
    if (!pages[msg.pageId]) {
      var page = webpage.create();
      pages[msg.pageId] = page;
    } else {
      resp.error = {
        message: "Page already exists: " + msg.pageId
      };
    }
    emit('response', resp);
  } else if (msg.method == 'exit') {
    setTimeout(function() { phantom.exit(0); }, 0);
    emit('response', resp);
  } else {
    // page commands
    var page = pages[msg.pageId];
    if (!page) {
      resp.error = {
        message: "Page not found: " + msg.pageId
      };
      emit('response', resp);
    } else {
      if (msg.method == 'setContent') {
        page.setContent(msg.params.content, msg.params.url);
        emit('response', resp);
      } else if (msg.method == 'open') {
        page.open(msg.params.url, msg.params.settings, function(status) {
          resp.result = status;
          emit('response', resp);
        });
      } else if (msg.method == 'injectJs') {
        var filePath = msg.params.filePath;
        resp.result = page.injectJs(filePath);
        emit('response', resp);
      } else if (msg.method == 'evaluate') {
        var args = [];
        var func = null;
        eval("func = " + msg.params.func); // effects local 'func'
        args.push(func);
        if (msg.params.args) {
          for (var i = 0; i < msg.params.args.length; ++i) {
            args.push(msg.params.args[i]);
          }
        }
        resp.result = page.evaluate.apply(page, args);
        emit('response', resp);
      } else if (msg.method == 'close') {
        page.close();
        pages[msg.pageId] = undefined;
        emit('response', resp);
      } else if (msg.method == 'onLoadFinished') {
        page.onLoadFinished = function(status) {
          resp.result = status;
          emit('event', resp);
        }
      }
    }
  }
};

controlPage.open("http://" + host + ":" + port, function(status) {
  console.log("Control page status: " + status);
});

