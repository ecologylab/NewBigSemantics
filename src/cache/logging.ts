import * as bunyan from 'bunyan';
import Log from '../utils/log';
import TaskMonitor from '../utils/taskMonitor';

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

export var taskMon = new TaskMonitor(10000);
export var logger = bunyan.createLogger({
  name: "DownloadPoolCache",
  streams: [{
      stream: process.stderr
    }, {
      type: 'raw',
      stream: taskMon
    },
    {
      type: 'rotating-file',
      path: 'DPCache.log',
      period: '1d',
      count: 7
    },
  ]
});

export default logger;