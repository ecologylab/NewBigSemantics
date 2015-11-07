// Phantom Master
// Node - PhantomJS bridge, in TypeScript.
//
// Originally from: https://github.com/alexscheelmeyer/node-phantom
// Modified by: Yin Qu (me.yin.qu@gmail.com)

/// <reference path='../../typings/tsd.d.ts' />

import events = require('events');
import http = require('http');
import path = require('path');
import socketio = require('socket.io');

// Returns a random element from the input array.
function randElem<T>(array: Array<T>): T {
  return array[Math.floor(Math.random() * array.length)];
}

// communication protocol:
//
// 1. always Request from master to phantomjs, and Response from phantomjs to
// master;
//
// 2. there should always be a Response for a Request;
//
// 3. for events:
//
//   3.1 master receives a request for adding an event listener;
//
//   3.2 master sends a Request with method 'addListener' and a hidden parameter
//   'listenerId' to phantomjs, and records the listenerId and the callback
//   function;
//
//   3.2 phantomjs adds a listener to a global or page event, and sends back the
//   (only) Response for the adding listener Request;
//
//   3.3 when the event happens, phantomjs sends a Response, with the given
//   listenerId, pageId (if applicable), and error or result back to master;
//
//   3.4 master calls the real callback, and remove the listener if persistent
//   is set to false.

interface Request {
  id: string;        // request id (must not be the same with any event name)
  method: string;
  params?: Object;
}

interface Response {
  id: string;        // request id or event name
  result?: any;
  error?: any;
}

interface Callback {
  (err: any, ...args: any[]): void;
}

interface ReqRecord {
  req?: Request;
  callback: Callback;
  persistent?: boolean; // if persistent, will not be removed
}

export class Master extends events.EventEmitter {
  private reqId: number = 1;
  private pageId: number = 1;

  private reqRecords: { [reqId: string]: ReqRecord } = {};

  constructor(private httpServer: http.Server, private io: SocketIO.Server) {
    super();

    var that = this;
    this.io.on('connection', function(socket: SocketIO.Socket) {
      console.log("New connection with ID " + socket.id);
      that.emit('connection');

      socket.on('response', function(msg: Response) {
        if (msg.id in that.reqRecords) {
          var record = that.reqRecords[msg.id];
          if (!record.persistent) {
            delete that.reqRecords[msg.id];
          }
          return record.callback(msg.error, msg.result);
        } else {
          return console.warn("Unrecognized message: %j", msg);
        }
      });
    });
  }

  newReqId(): string { return 'r' + String(this.reqId++); }

  private newPageId(): string { return 'p' + String(this.pageId++); }

  addMessageCallback(id: string,
                     callback: Callback,
                     request?: Request,
                     persistent?: boolean) {
    this.reqRecords[id] = {
      req: request,
      callback: callback,
      persistent: persistent || false,
    };
  }

  sendCmd(target: { emit(event: string, ...args: any[]): any },
          method: string,
          params: Object,
          callback: Callback): void {
    var cmd = {
      id: this.newReqId(),
      method: method,
      params: params,
    };
    target.emit('cmd', cmd);
    this.addMessageCallback(cmd.id, callback, cmd);
  }

  // event handling:

  private addListenerHelper(event: string,
                            once: boolean,
                            listener: Function): events.EventEmitter {
    var that = this;

    var listenerId = this.newReqId();

    // set up the real event listener
    this.addMessageCallback(listenerId, function(err, result)  {
      if (err) {
        return that.emit('error', new Error("Error with event " + event));
      }
      that.emit(event, result);
    }, null, !once);

    // send the request for adding listener
    this.sendCmd(this.io, 'addListener', {
      event: event,
      listenerId: listenerId,
    }, function(err) {
      if (err) {
        var errMsg = "Failed to add listener for event " + event + ": " + err.message;
        return that.emit('error', new Error(errMsg));
      }
    });

    return super.addListener(event, listener);
  }

  addListener(event: string, listener: Function): events.EventEmitter {
    return this.addListenerHelper(event, false, listener);
  }

  on(event: string, listener: Function): events.EventEmitter {
    return this.addListener(event, listener);
  }

  once(event: string, listener: Function): events.EventEmitter {
    return this.addListenerHelper(event, true, listener);
  }

  // actions:

  createPage(callback: (err: any, page: Page)=>void): void {
    var pageId = this.newPageId();
    var socket = randElem(this.io.sockets.sockets);
    var page = new Page(this, socket, pageId);
    this.sendCmd(socket, 'createPage', {
      pageId: pageId,
    }, function(err) {
      if (err) { return callback(err, null); }
      callback(null, page);
    });
  }

  exit(callback?: (err)=>void): void {
    this.sendCmd(this.io, 'exit', null, callback);
  }

  shutdown(): void {
    this.httpServer.close();
  }

}

export class Page extends events.EventEmitter {
  constructor(private master: Master, private socket: SocketIO.Socket, private id: string) {
    super();
  }

  getMaster(): Master { return this.master; }
  getSocket(): SocketIO.Socket { return this.socket; }
  getId(): string { return this.id; }

  // event handling:

  addListenerHelper(event: string, once: boolean, listener: Function): events.EventEmitter {
    var that = this;

    var listenerId = this.master.newReqId();

    // set up the real event listener
    this.master.addMessageCallback(listenerId, function(err, result)  {
      if (err) {
        return that.emit('error', new Error("Error with event " + event));
      }
      that.emit(event, result);
    }, null, !once);

    // send the request for adding listener
    this.master.sendCmd(this.socket, 'addListener', {
      pageId: this.id,
      event: event,
      listenerId: listenerId,
    }, function(err) {
      if (err) {
        var errMsg = "Failed to add listener for event " + event + ": " + err.message;
        return that.emit('error', new Error(errMsg));
      }
    });

    return super.addListener(event, listener);
  }

  addListener(event: string, listener: Function): events.EventEmitter {
    return this.addListenerHelper(event, false, listener);
  }

  on(event: string, listener: Function): events.EventEmitter {
    return this.addListener(event, listener);
  }

  once(event: string, listener: Function): events.EventEmitter {
    return this.addListenerHelper(event, true, listener);
  }

  // actions:

  open(url: string, settings: Object, callback?: (err, status: string)=>void) {
    this.master.sendCmd(this.socket, 'open', {
      pageId: this.id,
      url: url,
      settings: settings,
    }, callback);
  }

  setContent(content: string, url: string, callback?: (err)=>void): void {
    this.master.sendCmd(this.socket, 'setContent', {
      pageId: this.id,
      content: content,
      url: url,
    }, callback);
  }

  injectJs(filePath: string, callback?: (err, status: boolean)=>void): void {
    if (filePath) {
      var absPath = path.resolve(filePath);
      this.master.sendCmd(this.socket, 'injectJs', {
        pageId: this.id,
        filePath: absPath,
      }, callback);
    }
  }

  // The last arg is the callback!
  evaluate(func: (...params: any[])=>any, ...args: any[]): void {
    var params = {
      pageId: this.id,
      func: func.toString(),
      args: args.slice(0, args.length - 1)
    };
    var callback = args[args.length-1];
    this.master.sendCmd(this.socket, 'evaluate', params, callback);
  }

  close(callback?: (err)=>void): void {
    this.master.sendCmd(this.socket, 'close', {
      pageId: this.id,
    }, callback);
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

