// Master of phantoms.

/// <reference path="../../typings/main.d.ts" />

import * as child_process from "child_process";
import * as events from "events";
import * as Promise from "bluebird";

// The main class to control a group of phantoms.
export class Master {

  private phantoms: Array<Phantom>;

  constructor(options: any) {
    options = options || {
      count: 1,
    };
  }

  open(url: string): Page {
    if (this.phantoms.length < 0) {
      this.phantoms.push(new Phantom());
    }
    this.phantoms.pop().send({
      method: 'open',
      params: {
        url: url,
      },
    }, (err, result) => {
      
    })
    var i = Math.round(Math.random()*this.phantoms.length);
    var phantom = this.phantoms[i];
    if (!phantom.alive) {
      phantom.summon()
    }
    phantom.
  }

  openWith(content: string, url: string): Page {
  }

}

// Each Phantom object manages a phantomjs process, and respawn the process
// if it crashes.
//
// Each phantomjs instance can contain multiple pages.
class Phantom extends events.EventEmitter {
  
  proc: child_process.ChildProcess;

  io: 
  
  pages: { [pageId: string]: Page };

  constructor() {
    super();
    // TODO spawn the 
  }
  
  summon(): Phantom {
    // TODO
    return this;
  }
  
  open(url: string): Page {
    // TODO
  }
  
  openWith(content: string, url: string): Page {
    // TODO
  }
  
  send(msg: any): Promise<boolean> {
  }
  
  getPage(pageId: string): Page {
    return this.pages[pageId];
  }
  
}

export class Page {
  
  private phantom: Phantom;

  private promises: Array<Promise<any>>;
  
  constructor() {
    this.intermPromise = Promise.resolve(true)
  }

  injectJs(paths: Array<string>): Page {
    var injects = paths.map(path => {
      return this.phantom.send({
        method: 'injectJs',
        params: {
          path: paths[0],
        },
      });
    });
    promises.push(Promise.all(injects));
      
      
      Promise.() => {
      this.phantom.send(
    this.intermPromise.then(() => {
      this.phantom.send({
        method: 'injectJs',
        params: {
          path: paths[0],
        },
      }, );
    });
  }

  evaluate<T>(funct: (...params: Array<any>)=>T, ...args: Array<any>): Promise<T> {
  }

  close(): Promise<boolean> {
  }

}

