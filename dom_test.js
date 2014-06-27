// Copyright 2013 Google Inc. All Rights Reserved.


/** @suppress {extraProvide} */
goog.provide('jsaction.domTest');
goog.setTestOnly('jsaction.domTest');

goog.require('goog.testing.jsunit');
goog.require('jsaction.dom');


function testContains() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  var subchild = document.createElement('div');
  child.appendChild(subchild);
  root.appendChild(child);

  assertTrue(jsaction.dom.contains(root, root));
  assertTrue(jsaction.dom.contains(root, child));
  assertTrue(jsaction.dom.contains(root, subchild));
  assertTrue(jsaction.dom.contains(child, subchild));
  assertFalse(jsaction.dom.contains(subchild, root));
  assertFalse(jsaction.dom.contains(subchild, child));
}
