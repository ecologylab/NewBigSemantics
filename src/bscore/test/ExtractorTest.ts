import BSPhantom from '../bscore';
import * as pm from '../../phantom/master';
import * as path from 'path';

var options = { host: 'file://' + path.resolve(__dirname, 'test/amazon.html') };

// Files to inject for extraction
var bsjsFiles = [
  '../../../BigSemanticsJavaScript/bsjsCore/BSUtils.js',
  '../../../BigSemanticsJavaScript/bsjsCore/FieldOps.js',
  '../../../BigSemanticsJavaScript/bsjsCore/Extractor.js',
  '../../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js',
];

declare var extractMetadataSync: any;
declare var simpl: any;

var master = new pm.Master();
var agent = master.randomAgent();

function extract(url: string, mmd: any, callback: Function) {
  var page = agent.createPage();
  page.open(url)
      .injectJs(bsjsFiles)
      .evaluate(function(mmd) {
        var mmd = simpl.deserialize(mmd);
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
        
        return extractMetadataSync(resp, mmd, null, null);
      }, mmd)
      .then(result => callback(null, result))
      .close()
      .catch(err => callback(err, null));
}

describe("Without inheritance", () => {
  it("can extract scalar", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "scalar_test",
        kids: [
          {
            scalar: {
              name: "title",
              xpaths: [
                "//h1[@id='title' or @class='parseasinTitle ']"
              ]
            }
          }
        ]
      }
    });

    extract('file://' + path.resolve(__dirname, 'amazon.html'), mmd, function(err, metadata) {
      expect(err).toBe(null);

      expect(metadata.scalar_test.title).toBe("Discovery");
      done();
    });
  }, 5000);

  it("can extract composite", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "composite_test",
        kids: [{
          composite: {
            name: "bestseller_list_rank",
            xpaths: ["//li[@id='SalesRank']"],
            kids: [{
              scalar: {
                name: "title",
                xpaths: [".//b/a"]
              }
            }, {
              scalar: {
                name: "location",
                xpaths: [".//b/a/@href"]
              }
            }, {
              scalar: {
                name: "overall_rating",
                xpaths: ["./ul/li/span[@class='zg_hrsr_rank']"]
              }
            }]
          }
        }]
      }
    });

    extract('file://' + path.resolve(__dirname, 'amazon.html'), mmd, function(err, metadata) {
      expect(err).toBe(null);

      var md = metadata.composite_test;
      expect(md.bestseller_list_rank.location).toBe("http://www.amazon.com/gp/bestsellers/music/16269871/ref=pd_zg_hrsr_m_1_4_last");
      expect(md.bestseller_list_rank.overall_rating).toBe("#3");
      expect(md.bestseller_list_rank.title).toBe("French Pop");
      done();
    });
    
  }, 5000);

  it("can extract collection", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "collection_test",
        kids: [{
          collection: {
            name: "reviews",
            xpaths: ["//div[@id='revMHRL']/div[@id]"],
            kids: [{
              composite: {
                xpaths: ["."],
                name: "reviews",
                kids: [{
                  scalar: {
                    name: "title",
                    xpaths: [".//span[@class='a-size-base a-text-bold']"],
                    kids: []
                  }
                }]
              }
            }]
          }
        }]
      }
    });

    extract('file://' + path.resolve(__dirname, 'amazon.html'), mmd, function(err, metadata) {
      expect(err).toBe(null);

      var md = metadata.collection_test;
      expect(md.reviews[0].title).toBe("Perfect for the first time daft-er");
      expect(md.reviews[1].title).toBe("Brilliant. Awesome. I'd like to play it \"One More Time\"");
      expect(md.reviews[2].title).toBe("Brilliant CD! Best of the year so far.");
      done();
    });
  }, 5000);

  /*it("can extract composite/collection without xpath", () => {

  });*/
});