// Bridge script running inside PhantomJS.
"use strict";

var system = require('system');
var webpage = require('webpage');

var pactFile = system.args[0];
var id = system.args[1];
var host = system.args[2];
var port = system.args[3];
var masterUrl = 'http://' + host + ':' + port;
console.log("Pact file: " + pactFile);
console.log("ID: " + id);
console.log("Host: " + host);
console.log("Port: " + port);
console.log("Master URL: " + masterUrl);

// all non-control pages by id
var pages = {};

var controlPage = webpage.create();

// namespaces for method handlers
var globalMethods = {}, pageMethods = {};

// map of page -> ignored suffixes
// var ignoredSuffixesMap = {};

// map of filter urls -> callbacks
// var filterCallbacksMap = {};

function respond(id, err, result) {
  controlPage.evaluate(function(id, err, result) {
    window.socket.emit('response', {
      id: id,
      error: err,
      result: result
    });
  }, id, err, result);
}

function sendMsg(id, type, msg, params) {
  controlPage.evaluate(function(id, type, msg, params) {
    window.socket.emit(type, {
      id: id,
      text: msg,
      params: params
    });
  }, id, type, msg, params);
}

function assertParams(msg) {
  for (var i = 1; i < arguments.length; ++i) {
    var name = arguments[i];
    if (!(name in msg.params)) {
      respond(msg.id, "Missing required param: " + name, null);
      return false;
    }
  }
  return true;
}

// set up callback
controlPage.onCallback = function(msg) {
  if (msg.specialType) {
    switch (msg.specialType) {
      case 'exit':
        setTimeout(function() { phantom.exit(0); }, 1);
        break;
      default:
        console.error("Unknown specialType: " + JSON.stringify(msg, null, 2));
    }
    return;
  }

  if (!msg.id) {
    return console.error("Missing request ID: " + JSON.stringify(msg, null, 2));
  }
  if (!msg.method) {
    return console.error("Missing method: " + JSON.stringify(msg, null, 2));
  }
  msg.params = msg.params || {};

  console.log("Control page received message: " + msg.id + " - " + msg.method);

  if (msg.method in globalMethods) {
    // this is a global method; call with msg itself
    var m = globalMethods[msg.method];
    m(msg);
  } else if (msg.method in pageMethods) {
    // this is a page method; call with page and msg
    var page = pages[msg.params.pageId];
    if (page) {
      m = pageMethods[msg.method];
      m(page, msg);
    } else {
      respond(msg.id, "Page not found: " + msg.params.pageId, null);
    }
  } else {
    // error: unknown method
    respond(msg.id, "Unknown method: " + msg.method, null);
  }
};

// connect to master and send 'init' message to declare self
controlPage.open(masterUrl, function(status) {
  controlPage.evaluate(function(id, host, port, pactFile) {
    window.socket.emit('init', {
      agentId: id,
      host: host,
      port: Number(port),
      pactFile: pactFile
    });
  }, id, host, port, pactFile);
});

// global methods

globalMethods.createPage = function(msg) {
  if (assertParams(msg, 'pageId')) {
    var pageId = msg.params.pageId;
    var page = webpage.create();

    page.onCallback = function(msg) {
      if (msg.specialType) {
        switch(msg.specialType) {
          case "resp":
            respond(msg.id, msg.error, msg.result);
            break;
          default:
            console.error("Unknown specialType: " + JSON.stringify(msg, null, 2));
        }
      }
    }

    page.onResourceRequested = function(requestData, networkRequest) {
      var url = requestData.url;

      if (page.ignoredSuffixes) {
        var ext = url.split('?')[0].split('.').pop();
        if (page.ignoredSuffixes.indexOf(ext) != -1) {
          networkRequest.abort();
          return;
        }
      }

      if (page.proxy && url.indexOf("file://") !== 0 && url.indexOf("data:") !== 0) {
        var redirect = true;

        if (page.proxyBlacklist) {
          for (var i in page.proxyBlacklist) {
            if (url.indexOf(page.proxyBlacklist[i]) !== -1) {
              redirect = false;
              break;
            }
          }
        } else if (page.proxyWhitelist) {
          redirect = false;
          for (var i in page.proxyWhitelist) {
            if (url.indexOf(page.proxyWhitelist[i]) !== -1) {
              redirect = true;
            }
          }
        }

        if (redirect) {
          var newUrl = page.proxy + '?url=' + encodeURIComponent(url);
          console.log("Request redirected: " + newUrl);
          networkRequest.changeUrl(newUrl);
        } else {
          console.log("Request blocked: " + url);
        }
      }
    };

    page.onResourceReceived = function(response) {
      if (response.stage === "end") {
        // annoyingly, headers are not stored in an associative array
        for (var i = 0; i < response.headers.length; i++) {
          var header = response.headers[i];
          if (header.name === "X-Task-Info") {
            sendMsg(pageId, "proxy-task-info", decodeURI(header.value));
            break;
          }
        }
      }
    }

    page.onResourceError = function(resourceError) {
      console.error("Resource error: " + JSON.stringify(resourceError, null, 2));
    }

    page.onResourceTimeout = function(request) {
      console.warn("Resource timeout: " + JSON.stringify(request, null, 2));
    }

    page.onConsoleMessage = function(msg, lineNum, sourceId) {
      sendMsg(pageId, 'console', msg);
    };

    page.onError = function(msg, stack) {
      var trace = undefined;
      if (stack && stack.length) {
        var parts = [];
        stack.forEach(function(t) {
          parts.push(t.file + ':' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
        });
        trace = parts.join(', from ');
      }
      sendMsg(pageId, 'error', msg, { trace: trace, rawStack: stack });
    };

    pages[msg.params.pageId] = page;
    respond(msg.id, null, true);
  }
}

// utilities

function shadow(dest, src) {
  if (!src) return dest;
  return src;
}

// page methods

function processClientOptions(page, msg) {
  if (msg.params && msg.params.options) {
    page.ignoredSuffixes = shadow(page.ignoredSuffixes, msg.params.options.ignoredSuffixes);
    if (msg.params.options.proxyService) {
      page.proxy = shadow(page.proxy, msg.params.options.proxyService.endpoint);
      page.proxyBlacklist = shadow(page.proxyBlacklist, msg.params.options.proxyService.blacklist);
      page.proxyWhitelist = shadow(page.proxyWhitelist, msg.params.options.proxyService.whitelist);
    }
  }
}

pageMethods.open = function(page, msg) {
  if (assertParams(msg, 'url')) {
    processClientOptions(page, msg);
    page.open(msg.params.url, msg.params.settings, function(status) {
      respond(msg.id);
    });
  }
}

pageMethods.setContent = function(page, msg) {
  if (assertParams(msg, 'content', 'url')) {
    processClientOptions(page, msg);
    page.setContent(msg.params.content, msg.params.url);
    respond(msg.id);
  }
}

pageMethods.injectJs = function(page, msg) {
  if (assertParams(msg, 'files')) {
    var result = null;
    if (msg.params.files instanceof Array) {
      result = [];
      for (var i in msg.params.files) {
        var file = msg.params.files[i];
        result.push(page.injectJs(file));
      }
    } else {
      result = page.injectJs(msg.params.files);
    }
    respond(msg.id, null, result);
  }
}

pageMethods.evaluate = function(page, msg) {
  if (assertParams(msg, 'func')) {
    var args = []; // func, arg1, arg2, ..., argN
    var func = null;
    eval("func = " + msg.params.func); // effects local 'func'
    args.push(func);
    args.push.apply(args, msg.params.args || []);
    var result = page.evaluate.apply(page, args);
    respond(msg.id, null, result);
  }
}

pageMethods.evaluateAsync = function(page, msg) {
  if (assertParams(msg, 'func')) {
    var closure = function(id, func, args) {
      function respond(err, result) {
        window.callPhantom({ specialType: "resp", id: id, error: err, result: result });
      }
      eval("asyncfunc = " + func);
      asyncfunc.apply(null, args);
    }
    var pargs = [closure, msg.id, msg.params.func, msg.params.args || []]; // func, arg1, arg2, ..., argN
    page.evaluate.apply(page, pargs);
  }
}

pageMethods.close = function(page, msg) {
  page.close();
  delete pages[msg.params.pageId];
  respond(msg.id);
}
