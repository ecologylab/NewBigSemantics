export interface Log {
  datetime: Date;
  name: string;
  args?: any;
}

/*import * as bunyan from 'bunyan';

class Log {
  private static _logger: bunyan.Logger;

  static getLogger(): bunyan.Logger {
    if (!this._logger) {
      this._logger = bunyan.createLogger({
        name: "NewBigSemantics",
        streams: [{
          stream: process.stdout
        },
        {
          type: 'rotating-file',
          path: 'NewBigSemantics.log',
          period: '1d',
          count: 7
        }]
      });
    }

    return this._logger;
  }

  static trace(msg: Error | Buffer | Object, format?: any, ...params: any[]) {
    this.getLogger().trace.apply(this.getLogger(), arguments);
  }

  static debug(msg: Error | Buffer | Object | string, format?: any, ...params: any[]) {
    this.getLogger().debug.apply(this.getLogger(), arguments);
  }

  static info(msg: Error | Buffer | Object | string, format?: any, ...params: any[]) {
    this.getLogger().info.apply(this.getLogger(), arguments);
  }

  static warn(msg: Error | Buffer | Object | string, format?: any, ...params: any[]) {
    this.getLogger().warn.apply(this.getLogger(), arguments);
  }

  static error(msg: Error | Buffer | Object | string, format?: any, ...params: any[]) {
    this.getLogger().error.apply(this.getLogger(), arguments);
  }

  static fatal(msg: Error | Buffer | Object | string, format?: any, ...params: any[]) {
    this.getLogger().fatal.apply(this.getLogger(), arguments);
  }
}
*/