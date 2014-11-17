/**
 * @fileoverview Public static API for using jsaction.
 */

goog.provide('jsaction');

goog.require('jsaction.EventType');
goog.require('jsaction.dom');

/**
 * Create a custom event with the specified data.
 * @param {string} type The type of the action, e.g. 'submit'.
 * @param {!Object.<string, *>=} opt_data An optional data payload.
 * @param {!Event=} opt_triggeringEvent The event that triggers this custom
 *     event. This can be accessed from the custom event's action flow like
 *     so: actionFlow.event().detail.triggeringEvent.
 * @return {!Event} The new custom event.
 */
jsaction.createCustomEvent = function(type, opt_data, opt_triggeringEvent) {
  var event;

  // We use '_type' for the event contract, which lives in a separate
  // compilation unit, but also include the renamable keys so that event
  // consumers can access the data directly, e.g. detail.type instead of
  // detail['type'].
  var detail = {
    '_type': type,
    type: type,
    data: opt_data,
    triggeringEvent: opt_triggeringEvent
  };
  try {
    // We don't use the CustomEvent constructor directly since it isn't
    // supported in IE 9 or 10 and initCustomEvent below works just fine.
    event = document.createEvent('CustomEvent');
    event.initCustomEvent(jsaction.EventType.CUSTOM, true, false, detail);
  } catch (e) {
    // If custom events aren't supported, fall back to custom-named HTMLEvent.
    // Fallback used by Android Gingerbread, FF4-5.
    event = document.createEvent('HTMLEvents');
    event.initEvent(jsaction.EventType.CUSTOM, true, false);
    event['detail'] = detail;
  }

  return event;
};


/**
 * Fires a custom event with an optional payload. Only intended to be consumed
 * by jsaction itself. Supported in Firefox 6+, IE 9+, and all Chrome versions.
 *
 * TODO(user): Investigate polyfill options.
 *
 * @param {!Element} target The target element.
 * @param {string} type The type of the action, e.g. 'submit'.
 * @param {!Object.<string, *>=} opt_data An optional data payload.
 * @param {!Event=} opt_triggeringEvent An optional data for the Event triggered
 *     this custom event.
 */
jsaction.fireCustomEvent = function(
    target, type, opt_data, opt_triggeringEvent) {
  var event = jsaction.createCustomEvent(type, opt_data, opt_triggeringEvent);
  target.dispatchEvent(event);
};


/**
 * Fires a custom event to all children that listen for the specified jsaction.
 * Supported whereever fireCustomEvent is supported.
 *
 * @param {!Element} target The target element.
 * @param {string} type The type of the action, e.g. 'submit'.
 * @param {!Object.<string, *>=} opt_data An optional data payload.
*/
jsaction.broadcastCustomEvent = function(target, type, opt_data) {
  var matched = target.querySelectorAll("[jsaction*='" + type + "']");
  for (var i = 0; i < matched.length; ++i) {
    var match = matched[i];
    if (!jsaction.dom.hasAncestorInNodeList(match, matched)) {
      jsaction.fireCustomEvent(match, type, opt_data);
    }
  }
};
