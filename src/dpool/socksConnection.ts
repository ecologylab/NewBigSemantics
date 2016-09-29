import * as cp from 'child_process';
import * as request from 'request';
import * as nurl from 'url';
// var SocksProxyAgent = require('socks-proxy-agent');

export class SOCKSConnection {
  private proc: cp.ChildProcess;

  host: string;
  user: string;
  port: number;

  // Tracks if we're supposed to be closing or not
  // if connection closes without this being true,
  // an error occurred
  closing: boolean;

  constructor(host: string, user: string, port: number, proc: cp.ChildProcess) {
    this.host = host;
    this.user = user;
    this.port = port;

    this.proc = proc;
  }

  // download(url: string, userAgent?: string): Promise<any> {
  //   let port = this.port;

  //   let start = new Date();
  //   return new Promise<Buffer>((resolve, reject) => {
  //     request({
  //       url: url,
  //       agentClass: SocksProxyAgent,
  //       headers: { 'User-Agent': userAgent },
  //       agentOptions: nurl.parse("socks://localhost:" + port),
  //       pool: {
  //         maxSockets: 1
  //       }
  //     }, (err, resp, body) => {
  //       if (err) {
  //         // this.stats.failedDownloads += 1;
  //         reject(err);
  //         return;
  //       }

  //       let milliseconds = (new Date().getTime() - start.getTime());

  //       resolve(body);
  //     });
  //   });
  // }

  isConnected() {
    return this.proc.connected;
  }

  onError(callback: Function) {
    this.proc.on('close', () => {
      // unexpected close
      if (!this.closing) {
        callback();
      } 
    });
  }

  close() {
    this.closing = true;
    this.proc.stdin.write("exit\n");

    setTimeout(() => {
      // Let's make sure process is dead, don't want the port to be taken
      this.proc.kill();
    }, 500);
  }

  toJSON() {
    return {
      host: this.host,
      user: this.user,
      port: this.port,
      closing: this.closing
    }
  }
}

export function createConnection(host: string, user: string, port: number): Promise<SOCKSConnection> {
  return new Promise<SOCKSConnection>((resolve, reject) => {
    let open = false;
    // -tt forces pseudo-terminal allocation
    // necessary because we can't read ssh terminal output otherwise 
    let args = ["-D", String(port), "-o", "StrictHostKeyChecking=no", user + "@" + host, "-tt"];
    let proc = cp.spawn("ssh", args);

    console.log("Running `ssh " + args.join(' ') + '`');

    let timeout = setTimeout(() => {
      if (!open) {
        proc.kill();

        reject("timeout");
      }
    }, 15000);

    proc.stdout.on("data", (data: string) => {
      // Think this might be the only way we can confirm it opened successsfully
      if (data.indexOf("Last login") !== -1) {
        open = true;

        let conn = new SOCKSConnection(host, user, port, proc);

        resolve(conn);
        clearTimeout(timeout);
      }
    });

    proc.stderr.on("data", (data: string) => {
      if (data.indexOf("Permission denied") !== -1) {
        reject(data);
        clearTimeout(timeout);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
    });

    proc.on("close", (code, signal) => {
      if (!open) {
        reject("Connection rejected");
        clearTimeout(timeout);
      }
    });

    proc.on("exit", () => {
      proc.kill();
    });
  });
}
