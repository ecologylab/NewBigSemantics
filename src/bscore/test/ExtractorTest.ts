import BSPhantom from '../bscore';
import * as pm from '../../phantom/master';
import * as path from 'path';

var options = { host: 'file://' + path.resolve(__dirname, 'test/amazon.html') };

// Files to inject for extraction
var bsjsFiles = [
  path.resolve(__dirname, '../../../BigSemanticsJavaScript/bsjsCore/ParsedURL.js'),
  path.resolve(__dirname, '../../../BigSemanticsJavaScript/bsjsCore/BSUtils.js'),
  path.resolve(__dirname, '../../../BigSemanticsJavaScript/bsjsCore/FieldOps.js'),
  path.resolve(__dirname, '../../../BigSemanticsJavaScript/bsjsCore/Extractor.js'),
  path.resolve(__dirname, '../../../BigSemanticsJavaScript/bsjsCore/simpl/simplBase.js'),
];

declare var extractMetadataSync: any;
declare var simpl: any;

var master: pm.Master;

function extract(url: string, mmdStr: any, callback: Function) {
  var agent = master.randomAgent();
  var page = agent.createPage();
  page.open(url)
      .injectJs(bsjsFiles)
      .evaluate(function(mmdStr) {
        var mmd = simpl.deserialize(mmdStr);
        var resp = {
          code: 200,
          entity: document,
          location: document.location.href
        };
        return extractMetadataSync(resp, mmd, null, null);
      }, mmdStr)
      .then(result => { callback(null, result) })
      .close()
      .finally(() => { master.shutdown() });
}

describe("Without inheritance", () => {
  var pageURL = "file://" + path.resolve(__dirname, "amazon.html");

  beforeEach(function() {
    master = new pm.Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, 5000);

  it("can extract scalar", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "scalar_test",
        kids: [
          {
            scalar: {
              name: "title",
              scalar_type: "String",
              xpaths: [
                "//h1[@id='title' or @class='parseasinTitle ']"
              ]
            }
          }
        ]
      }
    });

    extract(pageURL, mmd, function(err, metadata) {
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
            type: "review",
            xpaths: ["//li[@id='SalesRank']"],
            kids: [{
              scalar: {
                name: "title",
                scalar_type: "String",
                xpaths: [".//b/a"]
              }
            }, {
              scalar: {
                name: "location",
                scalar_type: "ParsedURL",
                xpaths: [".//b/a/@href"]
              }
            }, {
              scalar: {
                name: "overall_rating",
                scalar_type: "String",
                xpaths: ["./ul/li/span[@class='zg_hrsr_rank']"]
              }
            }]
          }
        }]
      }
    });

    extract(pageURL, mmd, function(err, metadata) {
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
            child_type: "review",
            xpaths: ["//div[@id='revMHRL']/div[@id]"],
            kids: [{
              composite: {
                xpaths: ["."],
                name: "reviews",
                kids: [{
                  scalar: {
                    name: "title",
                    scalar_type: "String",
                    xpaths: [".//span[@class='a-size-base a-text-bold']"]
                  }
                }]
              }
            }]
          }
        }]
      }
    });

    extract(pageURL, mmd, function(err, metadata) {
      expect(err).toBe(null);

      var md = metadata.collection_test;
      expect(md.reviews[0].title).toBe("Perfect for the first time daft-er");
      expect(md.reviews[1].title).toBe("Brilliant. Awesome. I'd like to play it \"One More Time\"");
      expect(md.reviews[2].title).toBe("Brilliant CD! Best of the year so far.");
      done();
    });
  }, 5000);
});

describe("With JS modifying page", function() {
  var pageURL = "file://" + path.resolve(__dirname, "testpage.html");

  beforeEach(function() {
    master = new pm.Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, 5000);

  it("can extract unmodified content", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "mod",
        kids: [
          {
            scalar: {
              name: "target",
              xpaths: [
                "//p[@id='target']"
              ]
            }
          }
        ]
      }
    });

    extract(pageURL, mmd, function(err, metadata) {
      expect(err).toBe(null);
      expect(metadata.mod.target).toBe("Lorem ipsum dolor sit amet, consectetur adipiscing elit.");
      done();
    });
  }, 5000);
});

describe("With xpath variable", function() {
  var pageURL = "file://" + path.resolve(__dirname, "wikipedia.html");

  beforeEach(function() {
    master = new pm.Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, 5000);

  it("can extract Wikipedia section text", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "sections_text",
        kids: [{
          collection: {
            name: "sections",
            child_type: "section",
            xpaths: ["//div[@id='mw-content-text']/h2"],
            kids: [{
              composite: {
                name: "section",
                type: "section",
                kids: [{
                  scalar: {
                    name: "title",
                    scalar_type: "String",
                    xpaths: ["./span[@id]"]
                  }}, {
                  collection: {
                    name: "paragraphs",
                    child_type: "paragraph",
                    xpaths: ["./following-sibling::p[preceding-sibling::h2[1]=../h2[$i]]"],
                    kids: [{
                      composite: {
                        name: "paragraphs",
                        type: "paragraph",
                        kids: [{
                          scalar: {
                            name: "text",
                            scalar_type: "String",
                            xpaths: ["."]
                          }
                        }]
                      }
                    }]
                  }
                }]
              }
            }]
          }
        }]
      }
    });

    extract(pageURL, mmd, function(err, metadata) {
      expect(err).toBe(null);
      var md = metadata.sections_text;

      // To make the test fail without causing a TypeError
      if(md.sections[0].paragraphs && md.sections[0].paragraphs[0].text) {
        expect(md.sections[0].paragraphs[0].text).toContain("Velcro is the brainchild of");
        expect(md.sections[1].paragraphs[0].text).toContain("In 1958, de Mestral filed");
        expect(md.sections[2].paragraphs[0].text).toContain("Velcro Companies provides");
        expect(md.sections[3].paragraphs[0].text).toContain("The Neeson Cripps Academy");
        expect(md.sections[4].paragraphs[0].text).toContain("1968 - Velcro brand fasteners");
      } else {
        expect(md.sections[0].paragraphs).not.toBe(undefined);

        if(md.sections[0].paragraphs)
          expect(md.sections[0].paragraphs[0].text).not.toBe(undefined);
      }

      done();
    });
  }, 5000);
});

describe("With extract_as_html", function() {
  var pageURL = "file://" + path.resolve(__dirname, "testpage.html");

  beforeEach(function() {
    master = new pm.Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, 5000);

  it("can extract html", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "html_test",
        kids: [
          {
            scalar: {
              name: "text",
              extract_as_html: "true",
              xpaths: [
                "//p[@id='withInnerHtml']"
              ]
            }
          }
        ]
      }
    });

    extract(pageURL, mmd, function(err, metadata) {
      if(err) return;

      expect(metadata.html_test.text).toBe("<b>Bold Tag</b>");
      done();
    });
  }, 5000);
});

describe("With extracted URL", function() {
  var pageURL = "file://" + path.resolve(__dirname, "testpage.html");

  beforeEach(function() {
    master = new pm.Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, 5000);

  it("will extract as normalized URL", function(done) {
    var mmd = JSON.stringify({
      meta_metadata: {
        name: "url_test",
        kids: [
          {
            scalar: {
              name: "location",
              scalar_type: "ParsedURL",
              xpaths: [
                "//a[@id='link']/@href"
              ]
            }
          }
        ]
      }
    });

    extract(pageURL, mmd, function(err, metadata) {
      if(err) return;

      expect(metadata.url_test.location).toBe("http://www.amazon.com/Lexar-Professional-UHS-I-Rescue-Software/dp/B00VBNQK0E");
      done();
    });
  }, 5000);
});
