// Test Page.evaluate

import * as pm from './master';

var master = new pm.Master();
var agent = master.randomAgent();

// Test simple parameter passing
function testEval1() {
  var page = agent.createPage();
  page.open("")
      .evaluate(function(x: number, y: number) {
        return x + y;
      }, 5, 10)
      .then(result => console.log("Test1 [15]: ", result))
      .close()
      .catch(err => console.log("ERROR: ", err))
}

// Test mismatched parameters
function testEval2() {
  var page = agent.createPage();
  page.open("")
      .evaluate(function(x, y) {
        return x === 2 && y === undefined;
      }, 2)
      .then(result => console.log("Test2 [true]: ", result))
      .close()
      .catch(err => console.log("ERROR: ", err))
}

// Test more mismatched parameters 
function testEval3() {
  var page = agent.createPage();
  page.open("")
      .evaluate(function(x) {
        return x === 2;
      }, 2, 4, 8, 16)
      .then(result => console.log("Test3 [true]: ", result))
      .close()
      .catch(err => console.log("ERROR: ", err))
      .finally(() => master.shutdown());
}

testEval1();
testEval2();
testEval3();