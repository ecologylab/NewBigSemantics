// Promisify a callback based function / method.

// Convert a callback based function / method into a ES6 Promise.
//
// @arg func:
//   The function, or the name of a method on that.
//   The last arg to func is expected to be a callback.
//   The first arg to the callback is expected to be the error (can be null).
//
// @arg that:
//   The value of 'this' when eventually calling this function / method.
//
// (Function) => Promise
// (Function, Object) => Promise
// (methodName: string, Object) => Promise
function promisify(func, that) {
  if (typeof func == 'function' && (typeof that == 'undefined' || that == null)) {
    that = null;
  } else if (typeof func == 'function' && typeof that == 'object' && that != null) {
    // nothing to do
  } else if (typeof func == 'string' && typeof that == 'object' && that != null) {
    if (typeof that[func] != 'function') {
      throw new Error(methodName + " must be a valid func of 'that'.");
    }
    func = that[func];
  } else {
    throw new Error("Invalid arguments");
  }

  return function() {
    var args = new Array(arguments.length);
    for (var i = 0; i < arguments.length; ++i) {
      args[i] = arguments[i];
    }
    return new Promise(function(resolve, reject) {
      var callback = function() {
        if (arguments.length > 0) {
          var err = arguments[0];
          if (typeof err != 'undefined' && err != null) {
            reject(err);
            return;
          }
          var results = new Array(arguments.length - 1);
          for (var j = 1; j < arguments.length; ++j) {
            results[j-1] = arguments[j];
          }
          if (results.length == 0) {
            resolve();
          } else if (results.length == 1) {
            resolve(results[0]);
          } else {
            resolve(results);
          }
          return;
        }
        resolve();
      };
      args.push(callback);
      func.apply(that, args);
    });
  };
}

if (typeof module == 'object') {
  module.exports = promisify;
}

