/**
 * Test of Phantom master / agent / page.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as Promise from 'bluebird';
import * as config from '../../utils/config';
import Master from '../master';
import Agent from '../agent';
import Page from '../page';

let master = new Master({
  masterPort: 9088,
  numberOfInitialAgents: 1,
});

function test1(): Promise<any> {
  let page = master.randomAgent().createPage();
  return page
    .open('https://www.amazon.com/TCL-32S3800-32-Inch-Smart-Model/dp/B00UB9UJBA')
    .evaluate(function(xpath) {
      var result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
      return result.stringValue;
    }, "//meta[@name='keywords']/@content")
    .then(result => {
      console.log("sync result: " + result);
    })
    .evaluateAsync(`function(xpath) {
      var result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
      if (respond) {
        respond(null, result.stringValue);
      } else {
        console.error("respond() not found");
      }
      return result.stringValue;
    }`, "//meta[@name='keywords']/@content")
    .then(result => {
      console.log("async result: " + result);
    })
    .close()
    .catch(err => {
      console.error(err);
    }).getPromise();
}

function test2(): Promise<any> {
  let bsFile = path.resolve(__filename, '../../../../BigSemanticsJavaScript/build/bigsemantics-core.bundle.js');
  let repoFile = path.resolve(__filename, '../../../../BigSemanticsJavaScript/test/repo-all-160711.json');
  let serializedRepo = fs.readFileSync(repoFile, { encoding: 'utf8' });
  let page = master.randomAgent().createPage();
  return page
    .open('https://www.amazon.com/TCL-32S3800-32-Inch-Smart-Model/dp/B00UB9UJBA')
    .injectJs(bsFile)
    .evaluateAsync(`function(serializedRepo) {
      console.log("evaluating specified function");

      var repository = bigsemantics.deserialize(serializedRepo);
      console.log("repository deserialized");

      var bs = new bigsemantics.BSDefault();
      bs.load({
        appId: 'bsphantom-client-test',
        appVer: '0.0.0',
        repository: repository
      });
      console.log("BSDefault loaded");

      bs.loadMetadata(document.location.href, {
        response: {
          code: 200,
          entity: document,
          location: document.location.href
        }
      }).then(function(result) {
        respond(null, result.metadata);
      }).catch(function(err) {
        respond(err);
      });
    }`, serializedRepo)
    .then(result => {
      console.log("result: " + JSON.stringify(result, null, 2));
    })
    .close()
    .catch(err => {
      console.error(err);
    }).getPromise();
}

test1()
.then(() => test2())
.then(() => {
  master.shutdown();
});
