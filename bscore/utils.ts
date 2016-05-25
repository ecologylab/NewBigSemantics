// Utilities.

/// <reference path='../typings/tsd.d.ts' />

// Returns a random element from the input array.
export function randElem<T>(array: Array<T>): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Convert a callback based function / method into a ES6 Promise.
//
// Supported usage:
// (Function) => PromiseFactory
// (Function, Object) => PromiseFactory
// (methodName: string, Object) => PromiseFactory
//
// @arg func:
//   The function, or the name of a method on that.
//   The last arg to func is expected to be a callback.
//   The first arg to the callback is expected to be the error (can be null).
//
// @arg that:
//   The value of 'this' when eventually calling this function / method.
//
// Returns a Promise factory function.
export function promisify(func: Function | string, that: Object): (...args: any[])=>Promise<any> {
  var f: Function = null;

  if (typeof func === 'function') {
    f = func;
  } else if (typeof func === 'string' && typeof that === 'object' && that != null) {
    f = that[String(func)];
  }
  if (typeof f != 'function' ) {
    throw new Error("Invalid arguments");
  }

  return function(...args: any[]): Promise<any> {
    return new Promise(function(resolve: Function, reject: Function) {
      var callback = function(err: any, ...results: any[]) {
        if (err) { return reject(err); }
        resolve.apply(that, results);
      };
      args.push(callback);
      f.apply(that, args);
    });
  };
}

