// Phantomteer
// Node - PhantomJS bridge, in TypeScript.
//
// Originally from: https://github.com/alexscheelmeyer/node-phantom
// Modified by: Yin Qu (me.yin.qu@gmail.com)

/// <reference path='typings/tsd.d.ts' />

import http = require('http');
import socketio = require('socket.io');
import child_process = require('child_process');

class Error {
  constructor(public code: number,
              public message: string,
              public data?: any) {}
}

class Request {
  constructor(public rid: string,    // request id
              public pid: string,    // page id
              public method: string,
              public params?: any) {}
}

class Response {
  constructor(public rid: string,    // request id
              public pid: string,    // page id
              public result: any,
              public error?: Error) {}
}

interface Callback {
  (error: any, ...args: any[]): void;
}

interface Record {
  req: Request;
  callback: Callback;
  result?: any;
}

export class Controller {
  private reqId: number = 1;
  private pageId: number = 1;

  private records: { [id: string]: Record } = {};

  constructor(private httpServer: http.Server, private io: SocketIO.Server) {
    var ctrl = this;

    this.io.on('connection', function(socket: SocketIO.Socket) {
      console.log("New connection from " + socket.id);

      socket.on('response', function(msg: Response) {
        console.log("Response: " + JSON.stringify(msg));
        var record = ctrl.records[msg.rid];
        if (record) {
          var result = record.result ? record.result : msg.result;
          ctrl.records[msg.rid].callback(msg.error, result);
        }
      });

      socket.on('event', function(msg: Request) {
        console.log("Event: " + JSON.stringify(msg));
      });
    });
  }

  nextReq(pid: string, method: string, params?: any): Request {
    return new Request(''+this.reqId++, pid, method, params);
  }

  private nextPageId(): string { return '' + this.pageId++; }

  recordCallback(req: Request, callback: Callback, result?: any) {
    this.records[req.rid] = { req: req, callback: callback, result: result };
  }

  emitCmd(msg: Request): void { this.io.emit('cmd', msg); }

  createPage(callback: Callback): void {
    var req = this.nextReq(this.nextPageId(), 'createPage');
    var page = new Page(this, req.pid);
    this.recordCallback(req, callback, page);
    this.emitCmd(req);
  }

  exit(callback: Callback): void {
    var req = this.nextReq(null, 'exit');
    this.recordCallback(req, callback);
    this.emitCmd(req);
  }

  shutdown(): void {
    this.httpServer.close();
  }
}

export class Page {
  constructor(private controller: Controller, private id: string) {}

  getId(): string { return this.id; }

  // open() {}

  setContent(content: string, url: string, callback: Callback): void {
    var req = this.controller.nextReq(this.id, 'setContent', {
      content: content,
      url: url
    });
    this.controller.recordCallback(req, callback);
    this.controller.emitCmd(req);
  }

  // injectJs() {}

  evaluate(func: (...params: any[])=>any, ...args: any[]): void {
    var req = this.controller.nextReq(this.id, 'evaluate', {
      func: func.toString(),
      args: args.slice(0, args.length-1)
    });
    this.controller.recordCallback(req, args[args.length-1]);
    this.controller.emitCmd(req);
  }

  close(callback: Callback): void {
    var req = this.controller.nextReq(this.id, 'close');
    this.controller.recordCallback(req, callback);
    this.controller.emitCmd(req);
  }
}

export function createController(port: number,
                                 callback: Callback) {
  var httpServer = http.createServer(function(request, response) {
      response.writeHead(200, {"Content-Type": "text/html"});
      response.end(
        '<html><head>' +
        '<script src="/socket.io/socket.io.js" type="text/javascript">' +
        '</script>' +
        '<script type="text/javascript">' +
        '  window.onload = function() {' +
        '    var socket = io();' +
        '    socket.on("cmd", function(msg) {' +
        '      alert(JSON.stringify(msg));' +
        '    });' +
        '    window.socket = socket;' +
        '  };' +
        '</script>' +
        '</head><body></body></html>');
  });
  var io = socketio(httpServer);
  var controller = new Controller(httpServer, io);
  httpServer.listen(port, function() {      
    callback(null, controller);
  });
}


export function spawnPhantom(port: number,
                             callback: Callback,
                             options: any = {}) {
  if (options.phantomPath === undefined) { options.phantomPath = 'phantomjs'; }
  if (options.params === undefined) { options.params = {}; }

  var args = [];
  for (var param in options.params) {
    args.push('--' + param + '=' + options.params[param]);
  }
  args = args.concat([__dirname + '/bridge.js', port]);
  console.log("About to spawn Phantom, args: " + args);
  var phantom = child_process.spawn(options.phantomPath, args);

  var callbackDone = false;
  phantom.stdout.on('data', function(data) {
    console.log("Phantom out: " + data);
    if (!callbackDone && data && data.toString().indexOf('success') >= 0) {
      callbackDone = true;
      callback(null);
    }
  });
  phantom.stderr.on('data', function(data) {
    console.warn("Phantom err: " + data);
  });

  phantom.on('error', function(error) {
    console.log("Error spawning Phantom: " + error);
    if (!callbackDone) {
      callbackDone = true;
      callback(error);
    }
  });
  phantom.on('exit', function (code, signal) {
    console.log("Phantom Exitted with code " + code);
    if (signal) {
      console.log("    Received signal: " + signal);
    }
    if (!callbackDone) {
      callbackDone = true;
      callback({ message: "Process unexpectedly exitted.", code: code });
    }
  });
}

export function createControllerWithPhantom(port: number,
                                            callback: Callback,
                                            options: any = {}) {
  createController(port, function(error, controller) {
    if (error) {
      console.log("Failed to create controller.");
      callback(error);
    } else {
      console.log("Controller created.");
      spawnPhantom(port, function(error) {
        if (error) {
          console.log("Failed to spawn Phantom.");
          callback(error);
        } else {
          callback(null, controller);
        }
      });
    }
  });
}

var html = "<html><head><title>hello world</title></head><body>this is the body</body></html>";
var url = "about:test";
var xpath = "//title";
var func = function(xpath) {
  var result =
    document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
  return result.stringValue;
};
createControllerWithPhantom(8888, function(error, controller) {
  controller.createPage(function(error, page) {
    console.log("Page created, id = " + page.getId());
    page.setContent(html, url, function(error) {
      console.log("Content set.");
      page.evaluate(func, xpath, function(error, result) {
        console.log("Extracted scalar: " + result);
        page.close(function(error) {
          console.log("Page closed.");
          controller.exit(function(error) {
            console.log("Phantom exitted.");
            controller.shutdown();
          });
        });
      });
    });
  });
});

