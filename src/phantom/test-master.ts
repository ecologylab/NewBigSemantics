// Test new phantom master.

import * as pm from './master';

function test1() {
  var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";

  var master = new pm.Master();
  var agent = master.randomAgent();
  var page = agent.createPage();
  page
    .open(url)
    .evaluate(function(xpath) {
      var result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
      return result.stringValue;
    }, "//title")
    .then(result => console.log("RESULT: ", result))
    .close()
    .catch(err => console.error("ERROR: ", err))
    .finally(() => master.shutdown());
}

test1();
