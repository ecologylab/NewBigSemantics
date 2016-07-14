// BigSemantics with PhantomJS for extraction.
//
// WIP.

import ParsedURL from '../../BigSemanticsJavaScript/bsjsCore/ParsedURL';
import BigSemantics from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import RepoMan from '../../BigSemanticsJavaScript/bsjsCore/RepoMan';
import Readyable from '../../BigSemanticsJavaScript/bsjsCore/Readyable';
import { IBigSemantics, MetaMetadata } from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import { IExtractor } from '../../BigSemanticsJavaScript/bsjsCore/Extractor'
import { Downloader, IDownloader } from '../../BigSemanticsJavaScript/bsjsCore/Downloader';
import { BaseDownloader } from './downloader';
import * as pm from '../phantom/master';
import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';

// Files to inject for extraction
var bsjsFiles = [
  '../../BigSemanticsJavaScript/bsjsCore/BSUtils.js',
  '../../BigSemanticsJavaScript/bsjsCore/Readyable.js',
  '../../BigSemanticsJavaScript/bsjsCore/ParsedURL.js',
  '../../BigSemanticsJavaScript/bsjsCore/Downloader.js',
  '../../BigSemanticsJavaScript/bsjsCore/BSService.js',
  '../../BigSemanticsJavaScript/bsjsCore/RepoMan.js',
  '../../BigSemanticsJavaScript/bsjsCore/BigSemantics.js',
  '../../BigSemanticsJavaScript/bsjsCore/FieldOps.js',
  '../../BigSemanticsJavaScript/bsjsCore/Extractor.js',
  '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js',
];

declare var extractMetadata: IExtractor;
declare var respond: (err: any, result: any) => void;

var ignoreSuffixes = ['jpg', 'jpeg', 'tiff', 'gif', 'bmp', 'png', 'tga', 'css'];
var proxyURL = "http://api.ecologylab.net:3000/proxy?url=";
var proxyBlacklist = ['ecologylab.net'];

export default class BSPhantom extends BigSemantics {
  private options: any;
  private master: pm.Master;

  constructor(repoSource: any, options: any) {
    super(repoSource, options);
    this.options = options || {};
    this.master = this.options.master || new pm.Master();

    var mmdRepo = null;
    this.options.extractor = (() => {
      var extractor: IExtractor = (resp, mmd, bs, options, callback) => {
        var agent = this.master.randomAgent();
        var page = agent.createPage();

        if(!mmdRepo)
          mmdRepo = simpl.serialize(bs.getRepo());

        page.setIgnoredSuffixes(ignoreSuffixes)
            .onConsole(msg => console.log("Console: " + msg))
            .onError((err, trace) => console.log("Error: " + err));

        if (this.options.proxyURL) {
          page
            .setProxy(this.options.proxyURL)
            .setProxyBlacklist(proxyBlacklist);
        }

        page.open(resp.location)
            .injectJs(bsjsFiles)
            .evaluateAsync(function(mmdRepo) {
              // Quick fix because TypeScript changes to BigSemantics_1
              var repo = simpl.deserialize(mmdRepo);
              eval("var bs = new BigSemantics({ repo: repo }, {});");

              (bs as BigSemantics).onReady(function(err, bs) {
                bs.selectMmd(document.location.href, {}, function(err, mmd) {
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

                  extractMetadata(resp, mmd as MetaMetadata, bs, null, function(err, metadata) {
                    respond(err, metadata);
                  });
                });
              });
            }, mmdRepo)
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
