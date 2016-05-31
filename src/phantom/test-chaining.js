// Test chaining promise factories.

var Promise = require('bluebird');

var promise = Promise.resolve();

function chain(promiseFactory) {
  promise = promise.then(promiseFactory);
}

// test

function op(err, result, timeout) {
  return () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (err) {
          reject(err);
        } else {
          console.log("result: " + result);
          resolve(result);
        }
      }, timeout);
    });
  };
}

chain(op(null, 5, 1000));
chain(op(null, 4, 1500));
setTimeout(() => {
  chain(op(null, 3, 800));
  promise.then(result => {
    console.log("intermediate result: " + result);
  });
  chain(op(null, 2, 2000));
  chain(op(null, 1, 1800));
  chain(op(null, 0, 1800));

  promise
    .then(result => {
      console.log("final result: " + result);
    })
    .catch(err => {
      console.error(err);
    });
}, 5000);
