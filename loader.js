goog.provide('jsaction.Loader');

goog.requireType('jsaction.Dispatcher');
goog.requireType('jsaction.EventInfo');

/**
 * A loader is a function that will do whatever is necessary to register
 * handlers for a given namespace. A loader takes a dispatcher and a namespace
 * as parameters.
 * @typedef {function(!jsaction.Dispatcher,string,?jsaction.EventInfo):void}
 */
jsaction.Loader;
