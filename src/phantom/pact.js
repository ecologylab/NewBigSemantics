// Bridge script running inside PhantomJS.

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
var ignoredSuffixes = {};

// map of filter urls -> callbacks
var filterCallbacks = {};

// set up callback
controlPage.onCallback = function(msg) {
  if (msg.specialType) {
    switch (msg.specialType) {
      case 'exit':
        setTimeout(function() { phantom.exit(0); }, 1);
        break;
    }
    return;
  }

  if (!msg.id) {
    return console.warn("Missing request ID: ", JSON.stringify(msg));
  }
  if (!msg.method) {
    return console.warn("Missing method: ", JSON.stringify(msg));
  }
  msg.params = msg.params || {};

  if (msg.method in globalMethods) {
    // this is a global method; call with msg itself
    var m = globalMethods[msg.method];
    m(msg);
  } else if (msg.method in pageMethods) {
    // this is a page method; call with page and msg
    var page = pages[msg.params.pageId];
    if (page) {
      var m = pageMethods[msg.method];
      m(page, msg);
    } else {
      respond(msg.id, "Page not found: " + msg.params.pageId, null);
    }
  } else {
    // error: unknown method
    respond(msg.id, "Unknown method: " + msg.method, null);
  }
}
// connect to master and send 'init' message to declare self
controlPage.open(masterUrl, function(status) {
  console.log("Control page status: " + status);

  controlPage.evaluate(function(id, host, port, pactFile) {
    window.socket.emit('init', {
      agentId: id,
      host: host,
      port: Number(port),
      pactFile: pactFile
    });
  }, id, host, port, pactFile);
});

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

function respond(id, err, result) {
  controlPage.evaluate(function(id, result, err) {
    window.socket.emit('response', {
      id: id,
      result: result,
      err: err
    });
  }, id, result, err);
}

function sendMsg(id, type, msg, params) {
  controlPage.evaluate(function(type, id, msg, params) {
    window.socket.emit(type, {
      id: id,
      text: msg,
      params: params
    })
  }, type, id, msg, params);
}

// global methods

globalMethods.createPage = function(msg) {
  if (assertParams(msg, 'pageId')) {
    var pageId = msg.params.pageId;
    var page = webpage.create();

    page.onCallback = function(msg) {
      if(msg.specialType) {
        switch(msg.specialType) {
          case "resp":
            respond(msg.id, msg.err, msg.result);
            break;
        }
      }
    }

    page.onResourceRequested = function(requestData, networkRequest) {
      var url = requestData.url;

      if(page.ignoredSuffixes) {
        var ext = url.split('?')[0].split('.').pop();
        if(page.ignoredSuffixes.indexOf(ext) != -1) {
          console.log("Ignoring request for " + url);
          networkRequest.abort();
          return;
        }
      }

      if(page.proxy && url.indexOf("file://") === -1) {
        var redirect = true;

        if(page.proxyBlacklist) {
          for(var i in page.proxyBlacklist) {
            if(url.indexOf(page.proxyBlacklist[i]) !== -1) {
              redirect = false;
            }
          }  
        } else if(page.proxyWhitelist) {
          redirect = false;

          for(var i in page.proxyWhitelist) {
            if(url.indexOf(page.proxyWhitelist[i]) !== -1) {
              redirect = true;
            }
          }  
        }

        if(redirect) {
          var newUrl = page.proxy + encodeURIComponent(url);
          console.log("changing url to " + newUrl);
          networkRequest.changeUrl(newUrl);
        }
      }
    }

    // TODO this should be dynamically turned on / off too.
    /*
    page.onResourceError = function(resourceError) {
      console.log("resource error: " + JSON.stringify(resourceError, null, 4));
    }

    page.onResourceTimeout = function(request) {
      console.log("resource timeout: " + JSON.stringify(request, null, 4));
    }
    */

    page.onConsoleMessage = function(msg, lineNum, sourceId) {
      sendMsg(pageId, 'console', msg);
    };

    page.onError = function(msg, trace) {
      sendMsg(pageId, 'error', msg, { trace: trace });
    };

    pages[msg.params.pageId] = page;
    respond(msg.id, null, true);
  }
}

// page methods

pageMethods.open = function(page, msg) {
  if (assertParams(msg, 'url')) {
    page.open(msg.params.url, msg.params.settings, function(status) {
      respond(msg.id);
    });
  }
}

pageMethods.setIgnoredSuffixes = function(page, msg) {
  page.ignoredSuffixes = msg.params.suffixes;
  respond(msg.id);
}

pageMethods.setProxy = function(page, msg) {
  page.proxy = msg.params.proxyURL;

  respond(msg.id);
}

pageMethods.setProxyBlacklist = function(page, msg) {
  page.proxyBlacklist = msg.params.patterns;

  respond(msg.id);
}

pageMethods.setProxyWhitelist = function(page, msg) {
  page.proxyWhitelist = msg.params.patterns;

  respond(msg.id);
}

pageMethods.setContent = function(page, msg) {
  if (assertParams(msg, 'content', 'url')) {
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
    var closure = function(id, func, params) {
      function respond(err, result) {
        window.callPhantom({ specialType: "resp", id: id, result: result, err: err });
      }

      eval("f = " + func);

      f.apply(f, params);
    }

    var args = [closure, msg.id, msg.params.func, msg.params.args || []]; // func, arg1, arg2, ..., argN
    page.evaluate.apply(page, args);
  }
}

pageMethods.close = function(page, msg) {
  page.close();
  delete pages[msg.params.pageId];
  respond(msg.id);
}
