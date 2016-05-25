// Calculate coverage.

import fs = require('fs');
import path = require('path');
import coverage = require('./coverage');

var resultDir = 'result';

function parseFileName(fn) {
  var m = fn.match(/(\w+)-(\w)-(\w+)\.json/);
  if (m) {
    return {
      id: m[1],
      source: m[2],
      type: m[3],
    };
  }
  return null;
}

function genPairs() {
  var files = fs.readdirSync(resultDir);
  var pairs = new Object();
  for (var i in files) {
    for (var j in files) {
      var f1 = parseFileName(files[i]);
      var f2 = parseFileName(files[j]);
      if (f1 && f2 && f1.id == f2.id && f1.type == f2.type) {
        if (f1.source == 's' && f2.source == 'p') {
          var p1 = path.join(resultDir, files[i]);
          var p2 = path.join(resultDir, files[j]);
          pairs[p1] = p2;
        }
      }
    }
  }
  return pairs;
}

function main() {
  var pairs = genPairs();
  var files = Object.keys(pairs);
  var opts = { encoding: 'utf8' };
  for (var i in files) {
    var baseline = JSON.parse(fs.readFileSync(files[i], opts));
    var target = JSON.parse(fs.readFileSync(pairs[files[i]], opts));
    var url = baseline.location;
    var results = coverage.objectCoverage(baseline, target);
    var total = results[0];
    var covered = results[1];
    var rate = covered / total;
    console.log([url, total, covered, rate].join('\t'));
  }
}

main();

