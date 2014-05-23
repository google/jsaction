/**
 * @fileoverview The entry point for JsAction.  This is mean to be inlined in
 * the main HTML page.
 *
 * It will automatically read a list of event types from an element containing
 * the data-jsaction-events attribute and create a container for it. This
 * element must be present in the DOM for event binding to succeed.
 */

goog.provide('jsaction.eventContractAuto');

goog.require('jsaction.EventContract');


/**
 * Binds all events for a given JsAction container.
 * @param {!jsaction.EventContract} contract
 * @param {Element} container
 * @return {boolean} True, if events were successfully bound.
 */
function bindEventsForContainer(contract, container) {
  if (goog.isNull(container)) {
    return false;
  }
  var eventTypes = container.getAttribute('data-jsaction-events');
  if (!eventTypes) {
    return false;
  }
  contract.addContainer(container);

  eventTypes = eventTypes.split(',');
  for (var i = 0, eventType; eventType = eventTypes[i++];) {
    contract.addEvent(eventType);
  }
  return true;
}


/**
 * Creates an event contract.
 * @param {!Object} global
 */
function main(global) {
  var contract = new jsaction.EventContract();
  var container = document.querySelector('[data-jsaction-events]');
  if (bindEventsForContainer(contract, container)) {
    global['jsaction'] = {};
    global['jsaction']['__dispatchTo'] = function(dispatcher) {
      contract.dispatchTo(dispatcher);
    };
  }
}

// Bootstraps an event contract.
main(goog.global);
