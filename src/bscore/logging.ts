import * as bunyan from 'bunyan';
import Task from './task';
import Log from '../utils/log';

// Errors are not JSON serializable by default
// So create a toJSON prototype for Error 
// 
// http://stackoverflow.com/a/18391400
if (!('toJSON' in Error.prototype)) {
  Object.defineProperty(Error.prototype, 'toJSON', {
      value: function () {
          var alt = {};

          Object.getOwnPropertyNames(this).forEach(function (key) {
              alt[key] = this[key];
          }, this);

          return alt;
      },
      configurable: true,
      writable: true
  });
}

export var logs = new bunyan.RingBuffer({ limit: 10000 });
export var logger = bunyan.createLogger({
  name: "NewBigSemantics",
  streams: [{
      stream: process.stdout
    }, {
      type: 'raw',
      stream: logs
    },
    {
      type: 'rotating-file',
      path: 'NewBigSemantics.log',
      period: '1d',
      count: 7
    },
  ]
});

export default logger;