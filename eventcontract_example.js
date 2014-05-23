// Copyright 2011 Google Inc. All Rights Reserved.

/**
 *
 * @fileoverview The entry point for a jsbinary that instantiates
 * jsaction.EventContract and eventually passes it to an instance of
 * jsaction.Dispatcher. This is meant to be inlined in the main HTML
 * page.
 *
 * Cf. dispatcher_example.js, the external counterpart.
 *
 * This file serves as model for how Dispatcher and EventContract
 * cooperate, and to check that the code jscompiles properly.
 */

goog.provide('jsaction.eventContractExample');

goog.require('jsaction.EventContract');


/**
 * This function should be executed right when the page loads this
 * code, which should be inline and right after the body.
 *
 * @param {Window} window The window of the page this event
 * contract handles.
 */
function main(window) {
  var evc = new jsaction.EventContract;
  evc.addEvent('click');
  evc.addContainer(/** @type {!Element} */(window.document.body));

  // Cf. dispatcher_main.js.
  window['dispatcherOnLoad'] = function(dispatcher) {
    evc.dispatchTo(dispatcher);
  };
}

// The function is exported first such that loading the code and
// executing it is decoupled, which makes for more
// clarity. Specifically, the code could be inlined in head, but the
// body can only be registered as a container for the event contract
// after the <body> start tag, because before that it doesn't exist.
// Also, this prevents the code from being eliminated by jscompiler.
window['main'] = main;
