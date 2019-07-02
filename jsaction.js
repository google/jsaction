/**
 * @fileoverview Public static API for using jsaction.
 */

goog.provide('jsaction');

goog.require('goog.asserts');
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
  let event;

  // We use '_type' for the event contract, which lives in a separate
  // compilation unit, but also include the renamable keys so that event
  // consumers can access the data directly, e.g. detail.type instead of
  // detail['type'].
  const detail = {
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
  const event = jsaction.createCustomEvent(type, opt_data, opt_triggeringEvent);
  target.dispatchEvent(event);
};


/**
 * Fires a custom event at descendant elements. For a given descendant of the
 * target element, a custom event is fired if (1) it has a jsaction handler for
 * the action type, and (2) the element does not have an ancestor (also a
 * descendant of the target element) that already handled the event.
 * Supported wherever fireCustomEvent is supported.
 *
 * @param {!Element} target The target element.
 * @param {string} type The type of the action, e.g. 'submit'. Because of an
 *     implementation detail, type may not be 'click'.
 * @param {!Object.<string, *>=} opt_data An optional data payload.
 */
jsaction.broadcastCustomEvent = function(target, type, opt_data) {
  goog.asserts.assert(type != 'click');
  const matched = target.querySelectorAll(
      '[jsaction^="' + type + ':"], ' +
      '[jsaction*=";' + type + ':"], [jsaction*=" ' + type + ':"]');
  for (let idx = 0; idx < matched.length; ++idx) {
    const match = matched[idx];
    if (!jsaction.dom.hasAncestorInNodeList(match, matched)) {
      jsaction.fireCustomEvent(match, type, opt_data);
    }
  }
};
