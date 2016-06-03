// An extractor that uses phantomteer.

import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';
import * as bstypes from '../../BigSemanticsJavaScript/bsjsCore/bstypes';
import * as BigSemantics from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import * as Extractor from '../../BigSemanticsJavaScript/bsjsCore/Extractor'

import path = require('path');
//import simpl = require('../bigsemantics/bsjsCore/simpl/simplBase');
//import pm = require('./phantom-master');
import * as pm from '../phantom/master';

declare var extractMetadataSync: Extractor.IExtractorSync;

var bsjsFiles = [
  '../../BigSemanticsJavaScript/bsjsCore/BSUtils.js',
  '../../BigSemanticsJavaScript/bsjsCore/FieldOps.js',
  '../../BigSemanticsJavaScript/bsjsCore/Extractor.js',
  '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js',
];

interface Callback {
  (err: any, extractor: Extractor.IExtractor): void;
}

export function createPhantomExtractor(master: pm.Master, host: string, port: number, options: Object, callback: Callback): void {
  var agent = master.randomAgent();
  var page = agent.createPage();
  
  var phantomExtract: Extractor.IExtractor
    = //function(resp: bstypes.Response, mmd: BigSemantics.MetaMetadata,
      //         bigSemantics: BigSemantics.IBigSemantics, options: Object,
      //         mcallback: (err: any, metadata: BigSemantics.Metadata) => void): void {
        function(resp, mmd, bigSemantics, options, mcallback) {
          
       
    
    var smmd: string = simpl.serialize(mmd);
    
    page.open(host)
        .injectJs(bsjsFiles)
        .evaluate(() => {
          var mmd = simpl.deserialize(smmd);
          if ('meta_metadata' in mmd
              && mmd['meta_metadata']
              && mmd['meta_metadata']['name']) {
            mmd = mmd['meta_metadata'];
          }
          
          var resp = {
            code: 200,
            entity: document,
            location: document.location.href
          };
          
          return extractMetadataSync(resp, mmd as BigSemantics.MetaMetadata, null, null);
        })
      .then(result => { console.log(result); mcallback(null, result); })
      .close()
      .catch(err => { console.log("ERROR"); mcallback(err, null) });
  }
  
  callback(null, phantomExtract);
}

/*export function createPhantomExtractor(host: string,
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

      var phantomExtract: Extractor.IExtractor =
        function(resp: bstypes.Response,
                 mmd: BigSemantics.MetaMetadata,
                 bigSemantics: BigSemantics.IBigSemantics,
                 options: Object,
                 mcallback: (err: any, metadata: BigSemantics.Metadata)=>void): void {
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
                        code: 200,
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
*/