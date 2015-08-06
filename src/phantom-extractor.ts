// An extractor that uses phantomteer.

/// <reference path="./api/simpl.d.ts" />
/// <reference path="./api/bigsemantics.d.ts" />

import simpl = require('../bigsemantics/bsjsCore/simpl/simplBase');
import pm = require('./phantom-master');

declare var extractMetadataSync: (resp, mmd, bs, options)=>bigsemantics.Metadata;

var bsjsFiles = [
  '../bigsemantics/bsjsCore/simpl/simplBase.js',
  '../bigsemantics/bsjsCore/BSUtils.js',
  '../bigsemantics/bsjsCore/FieldOps.js',
  '../bigsemantics/bsjsCore/FieldParsers.js',
  '../bigsemantics/bsjsCore/Extractor.js'
];

interface Callback {
  (err: any, extractor: bigsemantics.IExtractor): void;
}

export function createPhantomExtractor(host: string,
                                       port: number,
                                       options: Object,
                                       callback: Callback): void {
  pm.createMaster(host, port, options, function(err, master) {
    if (err) { callback(err, null); return; }

    pm.spawnPhantom(host, port, options, function(err, phantom) {
      if (err) { callback(err, null); return; }

      phantom.stdout.on('data', function(data) {
        console.log("PHANTOM INFO: ", data.toString());
      });
      phantom.stderr.on('data', function(data) {
        console.warn("PHANTOM ERROR: ", data.toString());
      });
      phantom.on('error', function(err) {
        console.warn("PHANTOM CRITICAL: ", err);
      });
      phantom.on('exit', function (code, signal) {
        console.log("INFO: Phantom exitted; code=", code, ", signal=", signal);
      });

      var phantomExtract: bigsemantics.IExtractor =
        function(resp: bigsemantics.Response,
                 mmd: bigsemantics.MetaMetadata,
                 bigSemantics: bigsemantics.IBigSemantics,
                 options: Object,
                 mcallback: (err: any, metadata: bigsemantics.Metadata)=>void): void {
          var smmd: string = simpl.serialize(mmd);
          master.createPage(function(err, page) {
            if (err) { mcallback(err, null); return; }

            page.onLoadFinished(function(err, status) {
              if (err) { mcallback(err, null); return; }

              var toInject = bsjsFiles.length;
              for (var bsjsFile of bsjsFiles) {
                page.injectJs(bsjsFile, function(err, result) {
                  if (err) { mcallback(err, null); return; }
                  if (result == false) {
                    mcallback(new Error("Failed to inject " + bsjsFile), null);
                    return;
                  }

                  toInject--;
                  if (toInject == 0) {
                    var func = function(smmd): any {
                      var mmd = simpl.deserialize(smmd);
                      if ('meta_metadata' in mmd
                          && mmd['meta_metadata']
                          && mmd['meta_metadata']['name']) {
                        mmd = mmd['meta_metadata'];
                      }
                      var resp = {
                        entity: document,
                        location: document.location.href
                      };
                      var metadata = extractMetadataSync(resp, mmd, null, null);
                      return metadata;
                    };
                    page.evaluate(func, smmd, function(err, result) {
                      if (err) { mcallback(err, null); return; }
                      mcallback(null, result);
                    });
                  }
                });
              }
            });

            page.setContent(resp.text, resp.location);
          });
        };
      callback(null, phantomExtract);
    });
  });
}

