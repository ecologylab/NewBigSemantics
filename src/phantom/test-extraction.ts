import * as pm from './master';
import * as simpl from '../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase';
import ParsedURL from '../../BigSemanticsJavaScript/bsjsCore/ParsedURL';
import BigSemantics from '../../BigSemanticsJavaScript/bsjsCore/BigSemantics';
import RepoMan from '../../BigSemanticsJavaScript/bsjsCore/RepoMan';
import Downloader from '../../BigSemanticsJavaScript/bsjsCore/Downloader';

var mmdUrl = "http://api.ecologylab.net/BigSemanticsService/mmdrepository.json";
var url = "http://www.amazon.com/Discovery-Daft-Punk/dp/B000059MEK/ref=sr_1_1?s=music&ie=UTF8&qid=1365793732"

if (process.argv.length > 2) {
  url = process.argv[2];
}

var master = new pm.Master();
var agent = master.randomAgent();

var options = {
  downloader: new Downloader(),
  extractor: null,
  repoMan: null,
  page: 1
}

function extractionTest1() {
  var repoMan = new RepoMan({ url: mmdUrl }, options);

  repoMan.onReady((err, repoMan) => {
    if (err) { console.error(err); return; }
    console.log("RepoMan ready");

    options.repoMan = repoMan;
    options.extractor = createExtractor();
    console.log("Created extractor");
    
    var bs = new BigSemantics(null, options);
    bs.onReady((err, bs) => {
      console.log("BigSemantics Ready");
      if(err) { console.error(err); return; }
      bs.loadMetadata(url, options, (err, result) => {
        if(err) console.error(err);
        
        console.log(result.metadata);
      });
    });
  });
}

// Required so that TypeScript won't complain about this not existing
declare var extractMetadataSync;

function createExtractor() {
  var extractor = function (resp, mmd, bigSemantics, options, mcallback: (err: any, result: string | Object) => void) {
    var page = agent.createPage();
    var smmd = simpl.serialize(mmd);

    var clientScripts = [
      '../../BigSemanticsJavascript/bsjsCore/simpl/simplBase.js',
      '../../BigSemanticsJavascript/bsjsCore/BSUtils.js',
      '../../BigSemanticsJavascript/bsjsCore/FieldOps.js',
      '../../BigSemanticsJavascript/bsjsCore/Extractor.js',
    ];

    page.open(resp.location)
      .injectJs(clientScripts)
      .evaluate((smmd) => {
        console.log("About to deserialize smmd");
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

        return JSON.stringify(extractMetadataSync(resp, mmd, null, null));
      }, smmd)
      .then(result => mcallback(null, result))
      .catch(err => console.error("ERROR: ", err))
      .finally(() => master.shutdown());
  }
  
  return extractor;
}

extractionTest1();