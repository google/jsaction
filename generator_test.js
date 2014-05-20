/**
 */
goog.provide('jsaction.GeneratorTest');
goog.setTestOnly('jsaction.GeneratorTest');

goog.require('goog.testing.jsunit');
goog.require('jsaction.Property');
goog.require('jsaction.domGenerator');


function elem(id) {
  return document.getElementById(id);
}

function assertExpectedPath(g, expectedPath) {
  var count = 0;
  var i = 0;
  for (var n; n = g.next();) {
    assertEquals(expectedPath[i++], n);
  }
}

function testDomAncestorGenerator() {
  var g = jsaction.domGenerator.ancestors_;
  var target = elem('target');
  var container = elem('container');
  var expected = [
    elem('target'), elem('host'), elem('innercontainer'), container];
  g.reset_(target, container);
  assertExpectedPath(g, expected);
}


function testEventPathGenerator() {
  var g = jsaction.domGenerator.eventPath_;
  var container = elem('container');
  var expected = [
    elem('target'), elem('host'), elem('innercontainer'), container];
  g.reset_(expected, container);
  assertExpectedPath(g, expected);
}

function testDomAncestorGeneratorWithOwnerProperty() {
  var g = jsaction.domGenerator.eventPath_;
  var container = elem('containeractions');
  var actionNode = elem('actionnode');
  var owned = elem('owner');
  var element = elem('action-1');
  owned[jsaction.Property.OWNER] = element;
  var expected = [owned, element, actionNode, container];
  g.reset_(owned, container);
  assertExpectedPath(g, expected);

}

function testEventPathGeneratorWithOwnerProperty() {
  var g = jsaction.domGenerator.eventPath_;
  var container = elem('containeractions');
  var actionNode = elem('actionnode');
  var owned = elem('owner');
  var element = elem('action-1');
  owned[jsaction.Property.OWNER] = element;
  var expected = [owned, element, actionNode, container];

  g.reset_([owned], container);
  assertExpectedPath(g, expected);
}
