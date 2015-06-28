// The facade of BigSemantics

import downloader = require('downloader');

interface Metadata {
  mmdName: string;
}

class Task {
  constructor(public origUrl: string,
              public normUrl: string,
              public otherUrls: Array<string>,
              public rawPage: string,
              public mmd: any,
              public doc: Metadata,
              public logs: Array<any>) { }
}

interface DocStore {
}

class Extractor {
  constructor() {
  }
}

class BigSemantics {
  private docStore: DocStore;
  private downloader: downloader.Downloader;
  private extractor: Extractor;

  constructor() {
    this.docStore = null;
    this.downloader = new downloader.DefaultDownloader();
    this.extractor = new Extractor();
  }

  getMmd(url: string) {
    return 'xpath://title'; // TODO: return real mmd object
  }

  getMetadata(url: string, callback) {
    var mmd = this.getMmd(url);

    if (this.docStore != null) {
      // TODO: check doc store
    }

    this.downloader.download(url, function(error, resp) {
      if (error) {
        console.log("Error: " + error);
      } else {
        var html = resp.content;
        extractor.extract(mmd, html, function(error, result) {
          if (error) {
            console.log("Error: " + error);
            callback(error, null);
          } else {
            callback(null, result);
          }
        });
      }
    });
  }

  serialize(obj: Object): string {
    throw "todo";
  }
}

