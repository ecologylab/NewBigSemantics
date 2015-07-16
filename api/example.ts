// An example of using the new API

/// <reference path='proxy.ts' />

var bsSvc = new BSServiceProxy();
var bsExt = new BSExtensionProxy();
var bsPxy = new BSDispatchingProxy(bsSvc, bsExt);

function example1(clipping, renderer)
{
  // in ideamache, mice, or other webpage based interfaces ...

  function loadMetadataToTab(location, options, isSource)
  {
    bsPxy.loadMetadata(location, options, function(err, metadata) {
      var tabContent = null;
      if (err)
      {
        // tabContent = make error interface
      }
      else
      {
        tabContent = renderer.render(metadata); // mmd already joined w metadata
        if (isSource)
        {
          clipping.setSourceTabContent(tabContent);
        }
        else
        {
          clipping.addOutlinkTabWithContent(tabContent);
        }
        clipping.pickBestTab();
      }
    });
  }

  loadMetadataToTab(clipping.sourceUrl, null, true);
  for (var i in clipping.outlinks)
  {
    loadMetadataToTab(clipping.outlinks[i], null, false);
  }
}

// in browser extension

var bs = new BigSemantics({ file: 'repo.json' });
function example_onMessage(message: Request)
{
  if (message.method == 'loadMetadata')
  {
    bs.onReady(function(err, bs) {
      if (err)
      {
        // send error message back ...
        return;
      }

      bs.loadMetadata(message.params['location'], message.params['options'], function(err, metadata) {
        if (err)
        {
          // send error message back ...
          return;
        }
        
        var resp = { method: 'loadMetadata' }; // TODO assemble response object
        // send resp back ...
      })
    });
  }
}
