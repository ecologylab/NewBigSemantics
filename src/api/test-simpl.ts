// Test simpl.

/// <reference path='./simpl.d.ts' />

import simpl = require('../../bigsemantics/bsjsCore/simpl/simplBase');

function assert(cond) {
  if (!cond) {
    throw new Error("Assertion failed!");
  } else {
    console.log("Assertion passed.");
  }
}

function roundtrip() {
  var obj = {
    name: { firstname: 'first name', lastname: 'last name' },
    tags: [ 'tag1', 'tag2', 'tag3' ],
    refs: [ { name: { firstname: 'abc', lastname: 'def' } } ],
    gotcha: null,
    gotchaAgain: undefined
  }
  obj.refs.push(obj);

  var s = simpl.serialize(obj);
  console.log(s);

  var o: any = simpl.deserialize(s, { debugging: true });
  assert('first name' == o.name.firstname);
  assert('last name' == o.name.lastname);
  assert('tag1' == o.tags[0]);
  assert('tag2' == o.tags[1]);
  assert('tag3' == o.tags[2]);
  assert('abc' == o.refs[0].name.firstname);
  assert('def' == o.refs[0].name.lastname);
  assert('first name' == o.refs[1].name.firstname);
  assert('last name' == o.refs[1].name.lastname);
}

roundtrip();

