// Copyright 2011 Google Inc. All Rights Reserved.

/**
 *
 * @fileoverview The entry point for a JS binary that instantiates
 * jsaction.Dispatcher and connects it with an instance of
 * jsaction.EventContract that it receives from the main HTML
 * page. This is meant to be part of an externally loaded JS binary.
 *
 * Cf. eventcontract_example.js, the inlined counterpart.
 *
 * This file serves as model for how Dispatcher and EventContract
 * cooperate, and to check that the code jscompiles properly.
 */

goog.require('jsaction.ActionFlow');
goog.require('jsaction.Dispatcher');
goog.require('jsaction.replayEvent');



/**
 * This function is executed when the external js finishes loading. It
 * must be the last thing in the js. It calls a well known function on
 * window which was placed there by the event contract and passes its
 * own event callback there, where it's registered with event
 * contract.
 */
(function main() {
  var d = new jsaction.Dispatcher;
  d.registerHandlers('foo', null, {'bar': function() {}});

  var stats = new jsaction.ActionFlow('test_flow');
  stats.tick('t0');

  jsaction.replayEvent({
      'action': 'foo.bar',
      'event': /** @type {!Event} */({}),
      'eventType': 'click',
      'targetElement': /** @type {!Element} */({}),
      'actionElement': /** @type {!Element} */({}),
      'timeStamp': 1234
  });

  // See eventcontract_main.js.
  window['dispatcherOnLoad'](goog.bind(d.dispatch, d));
})();
