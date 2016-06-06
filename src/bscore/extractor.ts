// An extractor that uses phantomteer.

import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';
import * as BigSemantics from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import * as Extractor from '../../BigSemanticsJavaScript/bsjsCore/Extractor'
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

export function createPhantomExtractor(master: pm.Master, host: string, options: Object, callback: Callback): void {
  var agent = master.randomAgent();
  var page = agent.createPage();
  
  var phantomExtract: Extractor.IExtractor
    = function(resp, mmd, bigSemantics, options, mcallback) {
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
      .then(result => mcallback(null, result))
      .close()
      .catch(err => mcallback(err, null));
  }
  
  callback(null, phantomExtract);
}