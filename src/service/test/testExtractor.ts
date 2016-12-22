// Unit test for the PhantomJS-based extractor.

// FIXME whole file needs fix!!

/// <reference types="jasmine" />

import BSPhantom from '../bsPhantom';
import Master from '../../phantom/master';
import Agent from '../../phantom/agent';
import Page from '../../phantom/page';
import * as path from 'path';
import * as fs from 'fs';

// Files to inject for extraction
var bsjsFiles = [
  path.join(__dirname, '../bigsemantics-core.bundle.js'),
];

declare var extractMetadata:
  (resp, mmd, bs, options, callback: (err: Error, metadata: any) => void) => void;
declare var simpl: any;
declare var bs: any;
declare var BigSemantics: any;
declare var respond: (err: any, result: any) => void;

interface MetadataResult {
  (err: Error, metadata: any): void;
}

var master: Master;
var timeout = 5000;

function openPage(uri: string): Page {
  var agent = master.randomAgent();
  var page = agent.createPage();

  page.onConsole(msg => {
    // Stop cross-origin error spam
    if(msg.indexOf('Cross-origin') == -1)
      console.log("Console: " + msg);
  });

  page.onError((err, trace) => {
    console.log("Error: " + err)
  });

  return page.open(uri).injectJs(bsjsFiles);
}

function extract(uri: string, mmd: string, callback: MetadataResult) {
  var page = openPage(uri);

  page
    .evaluateAsync(function(smmd) {
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

      extractMetadata(resp, mmd, null, null, function(err, metadata) {
        respond(err, metadata);
      });
    }, mmd)
    .then(result => { callback(null, result); })
    .catch(err => { callback(err, null); })
    .close();
}

function extractWithRepo(uri: string, mmd: string, mmdName: string,
                                          callback: MetadataResult) {
  var mmdRepo = fs.readFileSync(
    path.resolve(__dirname,
      '../../../BigSemanticsJavaScript/bsjsCore/test/repo-all-160711.json'
    ),
    'utf8'
  );

  var page = openPage(uri);

  page.evaluateAsync(function(smmd, mmdName, mmdRepo) {
    var repo = simpl.deserialize(mmdRepo);
    var bs = new BigSemantics({ repo: repo }, {});

    bs.onReady(function(err, bs) {
      if(smmd) {
        doExtraction(simpl.deserialize(smmd), bs);
      } else {
        bs.loadMmd(mmdName, {}, function(err, mmd) {
          if ('meta_metadata' in mmd
            && mmd['meta_metadata']
            && mmd['meta_metadata']['name']) {
            mmd = mmd['meta_metadata'];
          }

          doExtraction(mmd, bs);
        });
      }
    });

    function doExtraction(mmd, bs) {
      var resp = {
        code: 200,
        entity: document,
        location: document.location.href
      };

      extractMetadata(resp, mmd, bs, null, function(err, metadata) {
        respond(err, metadata);
      });
    }
  }, mmd, mmdName, mmdRepo)
    .then(result => { callback(null, result); })
    .catch(err => { callback(err, null); })
    .close();
}

describe("Without inheritance", () => {
  var pageURL =
    "file://"
    + path.resolve(
      __dirname,
      "../../../BigSemanticsJavaScript/bsjsCore/test/amazon_product.html"
    );

  beforeEach(function() {
    master = new Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, timeout);

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
  }, timeout);

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
  }, timeout);

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
  }, timeout);
});

describe("With JS modifying page", function() {
  var pageURL =
    "file://"
    + path.resolve(
      __dirname,
      "../../../BigSemanticsJavaScript/bsjsCore/test/fake-page.html"
    );

  beforeEach(function() {
    master = new Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, timeout);

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
  }, timeout);
});

describe("With xpath variable", function() {
  var pageURL =
    "file://" +
    path.resolve(
      __dirname,
      "../../../BigSemanticsJavaScript/bsjsCore/test/wikipedia_article.html"
    );

  beforeEach(function() {
    master = new Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, timeout);

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
  }, timeout);
});

describe("With extract_as_html", function() {
  var pageURL =
    "file://"
    + path.resolve(
      __dirname,
      "../../../BigSemanticsJavaScript/bsjsCore/test/fake-page.html"
    );

  beforeEach(function() {
    master = new Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, timeout);

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
      expect(err).toBe(null);

      expect(metadata.html_test.text).toBe("<b>Bold Tag</b>");
      done();
    });
  }, timeout);
});

describe("With extracted URL", function() {
  var pageURL =
    "file://"
    + path.resolve(
      __dirname,
      "../../../BigSemanticsJavaScript/bsjsCore/test/fake-page.html"
    );

  beforeEach(function() {
    master = new Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, timeout);

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

    extractWithRepo(pageURL, mmd, null, function(err, metadata) {
      expect(err).toBe(null);

      expect(metadata.url_test.location).toBe("http://www.amazon.com/Lexar-Professional-UHS-I-Rescue-Software/dp/B00VBNQK0E");
      done();
    });
  }, timeout * 2);
});

describe("With inheritance", function() {
  var pageURL =
    "file://"
    + path.resolve(
      __dirname,
      "../../../BigSemanticsJavaScript/bsjsCore/test/amazon_product.html"
    );

  beforeEach(function() {
    master = new Master();
  });

  afterEach(function(done) {
    master.shutdown().then(() => done());
  }, timeout);

  it("can ignore unwanted inherited fields on composites", function(done) {
    extractWithRepo(pageURL, null, 'amazon_product', function(err, metadata) {
      expect(err).toBe(null);

      expect(metadata.amazon_product.companion_products[0].department).toBeUndefined();
      done();
    });
  }, timeout);
});
