// Copyright 2012 Google Inc. All rights reserved.

/**
 * @fileoverview Defines a "Null" ActionFlow object, which can be passed to
 * ActionFlow-requiring functions in lieu of an actual ActionFlow object.
 * Intended to be used by projects that are in the process of adopting
 * ActionFlow for latency tracking, or just need to use ActionFlow-requiring
 * code. Any attempt to branch or done a NullActionFlow will cause an assertion
 * failure - if your usage of NullActionFlow results in such an assertion
 * failure, you should switch to using an actual ActionFlow object instead.
 *
 * @author izaakr@google.com (Izaak Rubin)
 */

goog.provide('jsaction.NullActionFlow');

goog.require('goog.asserts');
goog.require('jsaction.ActionFlow');

/**
 * Creates a NullActionFlow.
 * @constructor
 * @extends {jsaction.ActionFlow}
 */
jsaction.NullActionFlow = function() {
  jsaction.NullActionFlow.base(this, 'constructor',
      jsaction.NullActionFlow.FLOW_TYPE_);
};
goog.inherits(jsaction.NullActionFlow, jsaction.ActionFlow);


/**
 * A default flow type to use for NullActionFlows.
 * @const {string}
 * @private
 */
jsaction.NullActionFlow.FLOW_TYPE_ = 'NULL_FLOW';


/**
 * Raises an assertion failure if called.
 * @override
 */
jsaction.NullActionFlow.prototype.branch = function(branch) {
  goog.asserts.fail('Attempted to branch a NullActionFlow - use a ActionFlow ' +
                    'instead to avoid this assertion failure.');
};


/**
 * Raises an assertion failure if called.
 * @override
 */
jsaction.NullActionFlow.prototype.done = function(branch) {
  goog.asserts.fail('Attempted to done a NullActionFlow - use a ActionFlow ' +
                    'instead to avoid this assertion failure.');
};
