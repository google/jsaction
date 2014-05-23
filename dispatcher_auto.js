/**
 * @fileoverview Instantiates a jsaction.Dispatcher and connects it with an
 * instance of jsaction.EventContract that it receives from the main HTML page.
 */

goog.provide('jsaction.dispatcherAuto');

goog.require('jsaction.Dispatcher');


/**
 * Registers a jsaction handler.
 * @param {string} action
 * @param {function(this:Element,Event)} handler
 * @param {Object=} opt_instance
 * @this jsaction.Dispatcher
 */
function register(action, handler, opt_instance) {
  var separatorIndex = action.indexOf('.');
  var namespace = action.substr(0, separatorIndex);
  var actionName = action.substr(separatorIndex + 1);
  var handlerMap = {};
  handlerMap[actionName] = function(actionFlow) {
    handler.call(actionFlow.node(), actionFlow.event());
  };
  this.registerHandlers(namespace, opt_instance || null, handlerMap);
}


/**
 * Unregisters a jsaction handler.
 * @param {string} action
 * @this jsaction.Dispatcher
 */
function unregister(action) {
  var separatorIndex = action.indexOf('.');
  var namespace = action.substr(0, separatorIndex);
  var actionName = action.substr(separatorIndex + 1);
  this.unregisterHandler(namespace, actionName);
}


/**
 * Creates a dispatcher and exposes a public API.
 * @param {!Object} global
 */
function main(global) {
  // If we can't find the exported jsaction namespace, it means we don't have an
  // available contract.
  if (!global['jsaction']) {
    return;
  }
  // Binds a dispatcher to the contract.
  var dispatcher = new jsaction.Dispatcher();
  global['jsaction']['__dispatchTo'](
      goog.bind(dispatcher.dispatch, dispatcher));

  // Exposes JsAction's public API.
  goog.exportSymbol('jsaction.register', goog.bind(register, dispatcher));
  goog.exportSymbol('jsaction.unregister', goog.bind(unregister, dispatcher));
}

// Bootstraps the dispatcher.
main(goog.global);
