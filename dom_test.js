// Copyright 2013 Google Inc. All Rights Reserved.


/** @suppress {extraProvide} */
goog.provide('jsaction.domTest');
goog.setTestOnly('jsaction.domTest');

goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.jsunit');
goog.require('jsaction.dom');


var stubs = new goog.testing.PropertyReplacer;

function tearDown() {
  stubs.reset();
}

function testContains() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  var subchild = document.createElement('div');
  child.appendChild(subchild);
  root.appendChild(child);

  assertTrue(jsaction.dom.contains(root, child));
  assertTrue(jsaction.dom.contains(root, subchild));
  assertTrue(jsaction.dom.contains(child, subchild));
  assertFalse(jsaction.dom.contains(subchild, root));
  assertFalse(jsaction.dom.contains(subchild, child));
}

function testContainsNoContains() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  var subchild = document.createElement('div');
  child.appendChild(subchild);
  root.appendChild(child);

  stubs.set(root, 'contains', null);
  stubs.set(child, 'contains', null);
  stubs.set(subchild, 'contains', null);

  assertTrue(jsaction.dom.contains(root, child));
  assertTrue(jsaction.dom.contains(root, subchild));
  assertTrue(jsaction.dom.contains(child, subchild));
  assertFalse(jsaction.dom.contains(subchild, root));
  assertFalse(jsaction.dom.contains(subchild, child));
}

function testContainsNoNativeFns() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  var subchild = document.createElement('div');
  child.appendChild(subchild);
  root.appendChild(child);

  stubs.set(root, 'contains', null);
  stubs.set(child, 'contains', null);
  stubs.set(subchild, 'contains', null);

  stubs.set(root, 'compareDocumentPosition', null);
  stubs.set(child, 'compareDocumentPosition', null);
  stubs.set(subchild, 'compareDocumentPosition', null);

  assertTrue(jsaction.dom.contains(root, child));
  assertTrue(jsaction.dom.contains(root, subchild));
  assertTrue(jsaction.dom.contains(child, subchild));
  assertFalse(jsaction.dom.contains(subchild, root));
  assertFalse(jsaction.dom.contains(subchild, child));
}
