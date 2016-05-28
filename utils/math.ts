// Simple math related utilities.

/// <reference path="../typings/index.d.ts" />

export function seq(n: number, startFrom: number = 0): Array<number> {
  var result = new Array();
  var k = startFrom;
  for (var i = 0; i < n; ++i) {
    result.push(k);
    k += 1;
  }
  return result;
}

export function shuffle(array: Array<any>): Array<any> {
  for (var i = array.length-1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}
