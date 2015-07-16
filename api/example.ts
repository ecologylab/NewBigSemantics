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

