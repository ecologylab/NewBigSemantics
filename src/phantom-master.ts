// Phantom Master
// Node - PhantomJS bridge, in TypeScript.
//
// Originally from: https://github.com/alexscheelmeyer/node-phantom
// Modified by: Yin Qu (me.yin.qu@gmail.com)

/// <reference path='../typings/tsd.d.ts' />

import proc = require('child_process');
import http = require('http');
import path = require('path');
import socketio = require('socket.io');

interface Request {
  id: string;        // request id
  pageId?: string;   // page id
  method: string;
  params?: Object;
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
  keepListening: boolean;
}

export class Master {
  private reqId: number = 1;
  private pageId: number = 1;

  private records: { [reqId: string]: Record } = {};

  constructor(private httpServer: http.Server, private io: SocketIO.Server) {
    var ctrl = this;

    this.io.on('connection', function(socket: SocketIO.Socket) {
      console.log("New connection from " + socket.id);

      function handleResponse(msg: Response) {
        console.log("Response: " + JSON.stringify(msg));
        if (msg.id in ctrl.records) {
          var record = ctrl.records[msg.id];
          if (record && typeof record.callback == 'function') {
            record.callback(msg.error, msg.result);
          }
          if (!record.keepListening) { delete ctrl.records[msg.id]; }
        }
      }

      socket.on('response', handleResponse);
      socket.on('event', handleResponse);
    });
  }

  newReqId(): string { return String(this.reqId++); }

  newPageId(): string { return String(this.pageId++); }

  sendCmd(cmd: Request, callback: Callback, keepListening: boolean = false): void {
    // currently it emits to all clients.
    // a single client might be good enough -- it can open multiple pages.
    // in the future, we may want a phantom farm.
    this.io.emit('cmd', cmd);
    if (typeof callback == 'function') {
      var record = {
        req: cmd,
        callback: callback,
        keepListening: keepListening
      };
      this.records[cmd.id] = record;
    }
  }

  createPage(callback: (err: any, page: Page)=>void): void {
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

  exit(callback?: (err)=>void): void {
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
  constructor(private master: Master, private id: string) {}

  getId(): string { return this.id; }

  newReq(method: string, params?: Object): Request {
    return {
      id: this.master.newReqId(),
      pageId: this.getId(),
      method: method,
      params: params
    };
  }

  open(url: string, settings: Object, callback?: (err, status: string)=>void) {
    var req = this.newReq('open', { url: url, settings: settings });
    this.master.sendCmd(req, callback);
  }

  setContent(content: string, url: string, callback?: (err)=>void): void {
    var req = this.newReq('setContent', { content: content, url: url });
    this.master.sendCmd(req, callback);
  }

  injectJs(filePath: string, callback?: (err, status: boolean)=>void): void {
    if (filePath) {
      var absPath = path.resolve(filePath);
      var req = this.newReq('injectJs', { filePath: absPath });
      this.master.sendCmd(req, callback);
    }
  }

  // The last arg is the callback!
  evaluate(func: (...params: any[])=>any, ...args: any[]): void {
    var params = {
      func: func.toString(),
      args: args.slice(0, args.length - 1)
    };
    var req = this.newReq('evaluate', params);
    var callback = args[args.length-1];
    this.master.sendCmd(req, callback);
  }

  close(callback?: (err)=>void): void {
    var req = this.newReq('close');
    this.master.sendCmd(req, callback);
  }

  onLoadFinished(callback: (err, status)=>void, keepListening: boolean = false): void {
    var req = this.newReq('onLoadFinished', null);
    this.master.sendCmd(req, callback, keepListening);
  }
}

export function createMaster(host: string,
                             port: number,
                             options: any,
                             callback: (err: any, master: Master)=>void) {
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
  var master = new Master(httpServer, io);
  httpServer.listen(port, function() {
    callback(null, master);
  });
}

export function spawnPhantom(host: string,
                             port: number,
                             options: any,
                             callback: (err: any, process: proc.ChildProcess)=>void) {
  if (options === undefined || options == null) { options = {}; }
  if (options.phantomPath === undefined) { options.phantomPath = 'phantomjs'; }
  if (options.params === undefined) { options.params = {}; }
  if (options.bridgeScript === undefined) {
    options.bridgeScript = __dirname + '/phantom-bridge.js';
  }

  var args = [];
  for (var param in options.params) {
    args.push('--' + param + '=' + options.params[param]);
  }
  console.log(options.bridgeScript);
  args = args.concat([options.bridgeScript, host, port]);
  var phantom = proc.spawn(options.phantomPath, args);
  setTimeout(function() { callback(null, phantom); }, 1000);
}

