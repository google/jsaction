/**
 * @fileoverview Public static API for using jsaction.
 */

goog.provide('jsaction');


/**
 * Fires a custom event with an optional payload. Only intended to be consumed
 * by jsaction itself. Supported in Firefox 6+, IE 9+, and all Chrome versions.
 *
 * TODO(user): Investigate polyfill options.
 *
 * @param {!Element} target The target element.
 * @param {string} type The type of the action, e.g. 'submit'.
 * @param {!Object.<string, *>=} opt_data An optional data payload.
 */
jsaction.fireCustomEvent = function(target, type, opt_data) {
  // We don't use the CustomEvent constructor directly since it isn't supported
  // in IE 9 or 10 and initCustomEvent below works just fine.
  try {
    var customEvent = document.createEvent('CustomEvent');
  } catch (e) {
    // TODO(user): Call directly into jsaction when events fail (FF4/5, Android
    // Gingerbread).
    return;
  }

  // We use '_type' for the event contract, which lives in a separate
  // compilation unit, but also include the renamable keys so that event
  // consumers can access the data directly, e.g. detail.type instead of
  // detail['type'].
  var detail = {'_type': type, type: type, data: opt_data};
  customEvent.initCustomEvent(jsaction.EventType.CUSTOM, true, false, detail);
  target.dispatchEvent(customEvent);
};
