// Copyright 2012 Google Inc. All rights reserved.

/**
 * @fileoverview Unit tests for NullActionFlow
 *
 * @author izaakr@google.com (Izaak Rubin)
 */

/** @suppress {extraProvide} */
goog.provide('jsaction.NullActionFlowTest');
goog.setTestOnly('jsaction.NullActionFlowTest');

goog.require('goog.testing.jsunit');
goog.require('jsaction.NullActionFlow');

function testBranchRaisesError() {
  var errorOnBranch = false;
  var nullFlow = new jsaction.NullActionFlow;
  try {
    nullFlow.branch('branch');
  } catch (e) {
    errorOnBranch = true;
  }
  assertTrue(errorOnBranch);
}

function testDoneRaisesError() {
  var errorOnDone = false;
  var nullFlow = new jsaction.NullActionFlow;
  try {
    nullFlow.done('branch');
  } catch (e) {
    errorOnDone = true;
  }
  assertTrue(errorOnDone);
}
