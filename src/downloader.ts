// Downloader

/// <reference path='typings/tsd.d.ts' />

import request = require('request');

export interface Response {
  location: string;
  otherLocations?: Array<string>;
  content: string;
}

export interface Callback {
  (error: string, resp: Response): void;
}

export interface Downloader {
  download(url: string, callback: Callback): void;
}

export class DefaultDownloader implements Downloader {
  download(url: string, callback: Callback) {
    request(url, function(error, response, body) {
      if (error == null) {
        callback(null, { location: url, response: response, content: body });
      } else {
        callback(error, null);
      }
    });
  }
}

// for testing:

var downloader = new DefaultDownloader();
var callback: Callback = function(error: string, result: Response) {
    if (error == null) {
      console.log(result.content);
    } else {
      console.log("Error: " + error);
    }
  };
downloader.download('http://dl.acm.org/citation.cfm?id=2557083', callback);

