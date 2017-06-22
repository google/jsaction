/**
 * @fileoverview File that exports symbols from the dispatcher to be used
 * in standalone binaries that drop the dispatcher script into their page.
 */

goog.provide('jsaction.dispatcherExport');

goog.require('jsaction.ActionFlow');
goog.require('jsaction.Dispatcher');


goog.exportSymbol('jsaction.ActionFlow', jsaction.ActionFlow);
goog.exportSymbol(
    'jsaction.ActionFlow.prototype.event', jsaction.ActionFlow.prototype.event);
goog.exportSymbol(
    'jsaction.ActionFlow.prototype.eventType',
    jsaction.ActionFlow.prototype.eventType);
goog.exportSymbol(
    'jsaction.ActionFlow.prototype.node', jsaction.ActionFlow.prototype.node);

goog.exportSymbol('jsaction.Dispatcher', jsaction.Dispatcher);
goog.exportSymbol(
    'jsaction.Dispatcher.prototype.dispatch',
    jsaction.Dispatcher.prototype.dispatch);
goog.exportSymbol(
    'jsaction.Dispatcher.prototype.registerHandlers',
    jsaction.Dispatcher.prototype.registerHandlers);
goog.exportSymbol(
    'jsaction.Dispatcher.prototype.setEventReplayer',
    jsaction.Dispatcher.prototype.setEventReplayer);
