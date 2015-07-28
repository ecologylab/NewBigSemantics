// Phantomteer
// Node - PhantomJS bridge, in TypeScript.
//
// Originally from: https://github.com/alexscheelmeyer/node-phantom
// Modified by: Yin Qu (me.yin.qu@gmail.com)

/// <reference path='typings/tsd.d.ts' />

import http = require('http');
import socketio = require('socket.io');
import child_process = require('child_process');

interface Request {
  id: string;        // request id
  pageId?: string;   // page id
  method: string;
  params?: any;
}

interface Response {
  id: string;        // request id
  pageId?: string;   // page id
  result?: any;
  error?: any;
}

interface Callback {
  (err: any, ...args: any[]): void;
}

interface Record {
  req: Request;
  callback: Callback;
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
        var record = ctrl.records[msg.id];
        if (record) {
          record.callback(msg.error, msg.result);
        }
      });

      socket.on('event', function(msg: Request) {
        console.log("Event: " + JSON.stringify(msg));
      });
    });
  }

  newReqId(): string { return String(this.reqId++); }

  newPageId(): string { return String(this.pageId++); }

  sendCmd(cmd: Request, callback: Callback): void {
    // currently it emits to all clients.
    // a single client might be good enough -- it can open multiple pages.
    // in the future, we may want a phantom farm.
    this.io.emit('cmd', cmd);
    this.records[cmd.id] = { req: cmd, callback: callback };
  }

  createPage(callback: (err, page)=>void): void {
    var req = {
      id: this.newReqId(),
      pageId: this.newPageId(),
      method: 'createPage'
    };
    var page = new Page(this, req.pageId);
    this.sendCmd(req, function(err) {
      if (err) { callback(err, null); }
      else { callback(null, page); }
    });
  }

  exit(callback: (err)=>void): void {
    var req = {
      id: this.newReqId(),
      method: 'exit'
    };
    this.sendCmd(req, callback);
  }

  shutdown(): void {
    this.httpServer.close();
  }
}

export class Page {
  constructor(private controller: Controller, private id: string) {}

  getId(): string { return this.id; }

  // open() {}

  setContent(content: string, url: string, callback: (err)=>void): void {
    var req = {
      id: this.controller.newReqId(),
      pageId: this.id,
      method: 'setContent',
      params: { content: content, url: url }
    };
    this.controller.sendCmd(req, callback);
  }

  // injectJs() {}

  // The last arg is the callback!
  evaluate(func: (...params: any[])=>any, ...args: any[]): void {
    var req = {
      id: this.controller.newReqId(),
      pageId: this.id,
      method: 'evaluate',
      params: { func: func.toString(), args: args.slice(0, args.length-1) }
    };
    var callback = args[args.length-1];
    this.controller.sendCmd(req, callback);
  }

  close(callback: (err)=>void): void {
    var req = {
      id: this.controller.newReqId(),
      pageId: this.id,
      method: 'close'
    };
    this.controller.sendCmd(req, callback);
  }
}

export function createController(host: string,
                                 port: number,
                                 options: any,
                                 callback: (err, ctrl)=>void) {
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

export function spawnPhantom(host: string,
                             port: number,
                             options: any,
                             callback: (err, process)=>void) {
  if (options === undefined || options == null) { options = {}; }
  if (options.phantomPath === undefined) { options.phantomPath = 'phantomjs'; }
  if (options.params === undefined) { options.params = {}; }

  var args = [];
  for (var param in options.params) {
    args.push('--' + param + '=' + options.params[param]);
  }
  args = args.concat([__dirname + '/bridge.js', host, port]);
  var phantom = child_process.spawn(options.phantomPath, args);
  setTimeout(function() { callback(null, phantom); }, 1000);
}

