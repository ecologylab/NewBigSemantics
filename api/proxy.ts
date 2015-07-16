// Proxies for delegating jobs to the extraction extension or the production
// service.

/// <reference path='bs.ts' />

// Jsut to declare the function signature, to make compiler happy
function simplDeserialize(serial: string): Object
{
  return {};
}

interface BSServiceLocation
{
  host: string;
  port: number;
  securePort: number;
}

var defaultService = {
  host: 'api.ecologylab.net', 
  port: 80,
  securePort: 443
};

// Delegate to the production service
class BSServiceProxy implements IBigSemantics
{

  private downloader: Downloader = new Downloader(null);
  
  constructor(private svcLoc: BSServiceLocation = defaultService) { }
  
  loadMetadata(location, options, callback)
  {
    var requestUrl = ''; // TODO assemble request URL to the prod service ...
    this.downloader.httpGet(requestUrl, null, function(err, response) {
      if (err) { callback(err, null); return; }
      // TODO handle additional errors
 
      var metadata = simplDeserialize(response.page); // TODO try catch
 
      var mmdOptions = {}; // fill out if necessary
      this.selectMmd(location, mmdOptions, function(err, mmd) {
        if (err) { callback(err, null); return; } 
 
        // at this point of time, we have both metadata and corresponding mmd.
        // thanks to JS closures, no need to explicitly maintain a queue.
 
        // TODO recursively join metadata with mmd ...
 
        callback(null, metadata);
      });
    });
  }

  loadMmd(name, options, callback) { /* TODO */ }

  selectMmd(location, options, callback)
  {
    var requestUrl = ''; // TODO assemble request URL ...
    this.downloader.httpGet(requestUrl, null, function(err, response) {
      if (err) { callback(err, null); return; }
 
      var mmd = simplDeserialize(response.page);
      callback(null, mmd);
    });
  }

  canonicalizeLocation(location, options, callback) { /* TODO */ }

}

// Delegate to the extraction extension
class BSExtensionProxy implements IBigSemantics
{

  private callbacks = {};
  private idCounter = 1;

  constructor() { /* TODO set up */ }

  private send(message: Request): void { /* TODO */ }

  private on(message: Response): void
  {
    this.callbacks[message.callbackId](message.error, message.result);
  }

  loadMetadata(location, options, callback)
  {
    var callbackId = this.idCounter++;
    this.callbacks[callbackId] = callback;
    this.send({
      method: 'loadMetadata',
      params: { location: location, options: options },
      callbackId: callbackId
    });
  }

  loadMmd(name, options, callback)
  {
    var callbackId = this.idCounter++;
    this.callbacks[callbackId] = callback;
    this.send({
      method: 'loadMmd',
      params: { name: name, options: options },
      callbackId: callbackId
    });
  }

  selectMmd(location, options, callback)
  {
    var callbackId = this.idCounter++;
    this.callbacks[callbackId] = callback;
    // may need special care if options contains DOM object
    // (for changing type based on content):
    this.send({
      method: 'selectMmd',
      params: { name: name, options: options },
      callbackId: callbackId
    });
  }

  canonicalizeLocation(location, options, callback)
  {
    var callbackId = this.idCounter++;
    this.callbacks[callbackId] = callback;
    this.send({
      method: 'canonicalizeLocation',
      params: { location: location, options: options },
      callbackId: callbackId
    });
  }

}

// Dispatches jobs to either the Extraction Extension or the production service.
class BSDispatchingProxy implements IBigSemantics
{

  // At least, you need a loader that uses the production service
  // if the extension is not installed, use null for extProxy
  constructor(public svcProxy: BSServiceProxy,
              public extProxy: BSExtensionProxy = null)
  {
    // nothing to do
  }

  loadMetadata(location, options, callback)
  {
    if (!this.extProxy || options['forceService'])
    {
      this.svcProxy.loadMetadata(location, options, callback);
    }
    else
    {
      this.extProxy.loadMetadata(location, options, callback);
    }
  }

  loadMmd(location, options, callback)
  {
    // similar to loadMetadata
  }

  selectMmd(location, options, callback)
  {
    // similar to loadMetadata
  }

  canonicalizeLocation(location, options, callback)
  {
    // similar to loadMetadata
  }

}

