// Bridge script running inside PhantomJS.

var system = require('system');
var host = system.args[1];
var port = system.args[2];
console.log("Host: " + host);
console.log("Port: " + port);

var emit = function(name, msg) {
  controlPage.evaluate(function(name, msg) {
    window.socket.emit(name, msg);
  }, name, msg);
}

var webpage = require('webpage');
var controlPage = webpage.create();

var pages = {
  'controlPage': controlPage, 
};

controlPage.onAlert = function(msgStr) {
  var msg = null;
  try {
    msg = JSON.parse(msgStr);
  } catch (error) {
    return console.warn("Ignoring unparsable message: ", msgStr);
  }
  if (!msg.id) {
    return console.warn("Missing request ID: ", msgStr);
  }
  if (!msg.method) {
    return console.warn("Missing method: ", msgStr);
  }
  msg.params = msg.params || {};

  if (msg.method === 'addListener' && !msg.params.pageId) {
    msg.params.pageId = 'controlPage';
  }

  var resp = { id: msg.id };

  if (msg.method === 'exit') {
    setTimeout(function() { phantom.exit(0); }, 1);
    emit('response', resp);
  } else if (msg.method === 'createPage') {
    if (!msg.params.pageId) {
      resp.error = { message: "Missing page ID" };
    } else if (msg.params.pageId in pages) {
      resp.error = { message: "Page already exists: " + msg.params.pageId };
    } else {
      var page = webpage.create();
      pages[msg.params.pageId] = page;
    }
    emit('response', resp);
  } else {
    // page commands
    var page = pages[msg.params.pageId];
    if (!page) {
      resp.error = { message: "Page not found: " + msg.params.pageId };
      emit('response', resp);
    } else {
      if (msg.method === 'addListener') {
        if (!msg.params.event) {
          resp.error = { message: "Missing event name" };
        } else if (!msg.params.listenerId) {
          resp.error = { message: "Missing listener ID" };
        } else {
          var eventName = 'on' + msg.params.event;
          if (!(eventName in page)) {
            resp.error = { message: "Event not found: " + eventName };
          } else {
            page[eventName] = function() {
              var args = new Array();
              for (var i = 0; i < arguments.length; ++i) {
                args.push(arguments[i]);
              }
              emit('response', {
                id: msg.params.listenerId,
                results: args,
              });
            };
          }
        }
        emit('response', resp);
      } else if (msg.method === 'setContent') {
        page.setContent(msg.params.content, msg.params.url);
        emit('response', resp);
      } else if (msg.method == 'open') {
        page.open(msg.params.url, msg.params.settings, function(status) {
          resp.result = status;
          emit('response', resp);
        });
      } else if (msg.method === 'injectJs') {
        var filePath = msg.params.filePath;
        resp.result = page.injectJs(filePath);
        emit('response', resp);
      } else if (msg.method === 'evaluate') {
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
      } else if (msg.method === 'close') {
        page.close();
        delete pages[msg.params.pageId];
        emit('response', resp);
      }
    }
  }
};

controlPage.open("http://" + host + ":" + port, function(status) {
  console.log("Control page status: " + status);
});

