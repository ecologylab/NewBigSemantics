// Downloader API

interface Response
{
  location: string;
  initialLocation?: string; // '?' means optional
  otherLocations?: Array<string>;

  code: number;
  mimeType?:string;
  charset?: string;

  page?: any;
}

// A callback function signature declaration to make the compiler happy
interface DownloadCallback
{
  // args: err, response. returns: void
  (err: Error, response: Response): void;
}

class Downloader
{

  // type annotation means: a string->number map; same below:
  private intervals: { [domain: string]: number } = {};
  private lastHits: { [domain: string]: number } = {};

  // type annotation means: a string->'Array of DownloadCallbacks' map
  private ongoing: { [location: string]: Array<DownloadCallback> } = {}

  constructor(private options: any)
  {
    if (options)
    {
      this.intervals = options.domainIntervals;
      // TODO other options
    }
  }

  httpGet(location: string, options: Object, callback: DownloadCallback): void
  {
    var downloader = this;
    function doHttpGet(): void
    {
      if (downloader.intervals[domain])
      {
        downloader.lastHits[domain] = Date.now();
      }
      var response = { location: location, code: 0 };
      // do http get via xhr ...
      // need to handle redirects and collect intermediate and final locations

      // if error happens: callback(error, null)
      // when xhr finishes: callback(null, response);

      // note: we are not doing any duplicate request detection / caching here,
      // because the browser will do caching transparently. on the server side,
      // we'll need to implement cache.
    }

    var domain = ''; // TODO get domain out of location
    if (this.intervals[domain])
    {
      if (this.lastHits[domain])
      {
        var elapsed = Date.now() - this.lastHits[domain];
        if (elapsed < this.intervals[domain])
        {
          setTimeout(doHttpGet, Date.now() - elapsed); // if we need to delay it
          return;
        }
      }
      else
      {
        this.lastHits[domain] = Date.now();
      }
    }
    doHttpGet(); // if we can do immediately
  }

}

