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
      resp(msg.id, null, "Page not found: " + msg.params.pageId);
    }
  } else {
    // error: unknown method
    resp(msg.id, null, "Unknown method: " + msg.method);
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
      resp(msg.id, null, "Missing required param: " + name);
      return false;
    }
  }
  return true;
}

function resp(id, result, err) {
  controlPage.evaluate(function(id, result, err) {
    window.socket.emit('response', {
      id: id,
      result: result,
      err: err
    });
  }, id, result, err);
}

// global methods

globalMethods.createPage = function(msg) {
  if (assertParams(msg, 'pageId')) {
    var page = webpage.create();

    // TODO add listeners for interested events
    page.onResourceRequested = function(requestData, networkRequest) {
      var url = requestData.url;

      if(page.ignoreSuffixes) {
        var ext = url.split('?')[0].split('.').pop();
        if(page.ignoreSuffixes.indexOf(ext) != -1) {
          networkRequest.abort();
        }
      }

      // Prevent proxying proxy requests and don't proxy filesystem requests (which are used for testing)
      if(url.indexOf("ecologylab.net:3000/proxy") === -1 && url.indexOf("file://") === -1)
        networkRequest.changeUrl("http://api.ecologylab.net:3000/proxy?url=" + url);
    }

    pages[msg.params.pageId] = page;
    resp(msg.id, true);
  }
}

// page methods

pageMethods.open = function(page, msg) {
  if (assertParams(msg, 'url')) {
    page.open(msg.params.url, msg.params.settings, function(status) {
      resp(msg.id, status);
    });
  }
}

pageMethods.setIgnoreSuffixes = function(page, msg) {
  page.ignoreSuffixes = msg.params.suffixes;
}

pageMethods.setContent = function(page, msg) {
  if (assertParams(msg, 'content', 'url')) {
    page.setContent(msg.params.content, msg.params.url);
    resp(msg.id);
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
    resp(msg.id, result);
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
    resp(msg.id, result);
  }
}

pageMethods.close = function(page, msg) {
  page.close();
  delete pages[msg.params.pageId];
  resp(msg.id);
}
