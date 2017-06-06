/**
 * @fileoverview File that exports symbols from the event contract to be used
 * in standalone binaries that drop the event contract script into their page.
 */

goog.provide('jsaction.eventContractExport');

goog.require('jsaction.EventContract');


goog.exportSymbol('jsaction.EventContract', jsaction.EventContract);
goog.exportSymbol(
    'jsaction.EventContract.prototype.addContainer',
    jsaction.EventContract.prototype.addContainer);
goog.exportSymbol(
    'jsaction.EventContract.prototype.addEvent',
    jsaction.EventContract.prototype.addEvent);
goog.exportSymbol(
    'jsaction.EventContract.prototype.dispatchTo',
    jsaction.EventContract.prototype.dispatchTo);
