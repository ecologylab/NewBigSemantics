// BigSemantics with PhantomJS for extraction.
//
// WIP.

import ParsedURL from '../../BigSemanticsJavaScript/bsjsCore/ParsedURL';
import BigSemantics from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import RepoMan from '../../BigSemanticsJavaScript/bsjsCore/RepoMan';
import Readyable from '../../BigSemanticsJavaScript/bsjsCore/Readyable';
import { IBigSemantics, MetaMetadata } from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import { IExtractor, IExtractorSync } from '../../BigSemanticsJavaScript/bsjsCore/Extractor'
import { Downloader, IDownloader } from '../../BigSemanticsJavaScript/bsjsCore/Downloader';
import { BaseDownloader } from './downloader';
import * as pm from '../phantom/master';
import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';

// Files to inject for extraction
var bsjsFiles = [
  '../../BigSemanticsJavaScript/bsjsCore/BSUtils.js',
  '../../BigSemanticsJavaScript/bsjsCore/FieldOps.js',
  '../../BigSemanticsJavaScript/bsjsCore/Extractor.js',
  '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js',
];

declare var extractMetadataSync: IExtractorSync;

export default class BSPhantom extends BigSemantics {
  constructor(repoSource: any, options: any) {
    var master = new pm.Master();

    if (!options) {
      options = {};
    }
    
    options.extractor = (() => {
      var extractor: IExtractor = (resp, mmd, bs, options, callback) => {
        var smmd = simpl.serialize(mmd);
        var agent = master.randomAgent();
        var page = agent.createPage();
      
        page.open(resp.location)
            .injectJs(bsjsFiles)
            .evaluate(function(smmd) {
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
              
              return extractMetadataSync(resp, mmd as MetaMetadata, null, null);
            }, smmd)
            .then(result => callback(null, result))
            .close()
            .catch(err => callback(err, null));
      };
      
      return extractor;
    })();
    
    if (!options.downloader) {
      options.downloader = new BaseDownloader();
    }
    
    super(repoSource, options);
  }
}