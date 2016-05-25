// Test new phantom master.


import { Phantom } from './master';

function test1() {
  var url = "http://www.amazon.com/Coaster-900280-Snack-Burnished-Copper/dp/B004J8PAPE/";

  var master = new Phantom();
  var page = master.open(url);
  page
    .evaluate(function(xpath) {
      var result = document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null);
      return result.stringValue;
    }, "//title")
    .then(result => console.log(result))
    .error(err => console.error(err)); 
  page.close()
    .then(result => console.log("page closed"))
    .error(err => console.error(err));
}
}

test1();
