/**
 * @mods {jsaction.Dispatcher}
 * @modName {a11yInDispatcherMod}
 */
goog.provide('jsaction.DispatcherA11yMod');

goog.require('goog.dom.TagName');
goog.require('jsaction.A11y');
goog.require('jsaction.Dispatcher');
goog.require('jsaction.EventType');
goog.require('jsaction.event');
goog.require('jsaction.triggerEvent');


/**
 * Makes a shallow copy of the EventInfo queue, where any MAYBE_CLICK_EVENT_TYPE
 * event-typed events get their type converted to 'CLICK's or are retriggered as
 * KEYDOWN events. Because clients of jsaction must provide their own
 * implementation of how to replay queued events, this removes the need for
 * those clients to know how to handle MAYBE_CLICK_EVENT_TYPE events.
 *
 * @param {!Array<!jsaction.EventInfo>} eventInfoQueue
 * @return {!Array<!jsaction.EventInfo>}
 * @suppress {duplicate}
 */
jsaction.Dispatcher.prototype.cloneEventInfoQueue = function(eventInfoQueue) {
  return eventInfoQueue
      .map((eventInfo) => {
        return this.maybeResolveA11yEvent(eventInfo);
      })
      // MAYBE_CLICK_EVENT_TYPE events that are not action-key events get mapped
      // to 'null'.
      .filter((eventInfo) => !!eventInfo);
};


/**
 * If a 'maybe_a11y_event' event was dispatched, check if the event represents
 * a 'click'. If so, it will be dispatched as a click event. If not, we will
 * retrigger the event so that the event contract can find the correct keydown
 * action for it.
 *
 * @param {!jsaction.EventInfo} eventInfo
 * @param {boolean=} isGlobalDispatch Whether the eventInfo is meant to be
 *     dispatched to the global handlers.
 * @return {?jsaction.EventInfo} Returns a jsaction.EventInfo object with the
 *     MAYBE_CLICK_EVENT_TYPE converted to CLICK or KEYDOWN if we can keep
 *     dispatching this event, or returns NULL if this event was triggered
 *     without dispatching.
 * @suppress {duplicate}
 */
jsaction.Dispatcher.prototype.maybeResolveA11yEvent = function(
    eventInfo, isGlobalDispatch = false) {
  if (eventInfo['eventType'] !== jsaction.A11y.MAYBE_CLICK_EVENT_TYPE) {
    return eventInfo;
  }

  const /** !jsaction.EventInfo */ eventInfoCopy =
      /** @type {!jsaction.EventInfo} */ ({...eventInfo});
  const event = eventInfoCopy['event'];

  if (this.isA11yClickEvent_(eventInfo, isGlobalDispatch)) {
    if (this.shouldPreventDefault_(eventInfoCopy)) {
      jsaction.event.preventDefault(event);
    }
    // If the keydown event can be treated as a click, we change the eventType
    // to 'click' so that the dispatcher can retrieve the right handler for it.
    // Even though EventInfo['action'] corresponds to the click action, the
    // global handler and any custom 'getHandler' implementations may rely on
    // the eventType instead.
    eventInfoCopy['eventType'] = jsaction.EventType.CLICK;
    return eventInfoCopy;
  } else {
    // Otherwise, if the keydown can't be treated as a click, we need to
    // retrigger it because now we need to look for 'keydown' actions instead.
    // We trigger the event from the targetElement to ensure we don't miss any
    // keydown actions.
    if (isGlobalDispatch) {
      // This doesn't need to go back to the event contract because we don't
      // need to find a corresponding action. Send it directly to any global
      // handlers.
      eventInfoCopy['eventType'] = jsaction.EventType.KEYDOWN;
      return eventInfoCopy;
    } else {
      const eventCopy = jsaction.event.maybeCopyEvent(event);
      // This prevents the event contract from setting the
      // jsaction.A11y.MAYBE_CLICK_EVENT_TYPE type for Keydown events.
      eventCopy[jsaction.A11y.SKIP_A11Y_CHECK] = true;
      // Since globally dispatched events get handled above, we don't want the
      // event contract to retrigger it when we retrigger this event.
      eventCopy[jsaction.A11y.SKIP_GLOBAL_DISPATCH] = true;
      // Retrigger the event asynchronously to avoid "Event already being
      // dispatched" DOM error.
      setTimeout(() => {
        jsaction.triggerEvent(eventInfo['targetElement'], eventCopy);
      }, 0);
    }
  }
  return null;
};

/**
 * Returns true if the given key event can be treated as a "click".
 *
 * @param {!jsaction.EventInfo} eventInfo
 * @param {boolean=} isGlobalDispatch Whether the eventInfo is meant to be
 *     dispatched to the global handlers.
 * @return {boolean}
 * @private
 */
jsaction.Dispatcher.prototype.isA11yClickEvent_ = function(
    eventInfo, isGlobalDispatch) {
  return (isGlobalDispatch || eventInfo['actionElement']) &&
      jsaction.event.isActionKeyEvent(eventInfo['event']);
};

/**
 * Returns true if the default action for this event should be prevented
 * before the event handler is envoked.
 *
 * @param {!jsaction.EventInfo} eventInfo
 * @return {boolean}
 * @private
 */
jsaction.Dispatcher.prototype.shouldPreventDefault_ = function(eventInfo) {
  // For parity with no-a11y-support behavior.
  if (!eventInfo['actionElement']) {
    return false;
  }
  const event = eventInfo['event'];
  // Prevent scrolling if the Space key was pressed
  if (jsaction.event.isSpaceKeyEvent(event)) {
    return true;
  }
  // or prevent the browser's default action for native HTML controls.
  if (jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(event)) {
    return true;
  }
  // Prevent browser from following <a> node links if a jsaction is present
  // and we are dispatching the action now. Note that the targetElement may be a
  // child of an anchor that has a jsaction attached. For that reason, we need
  // to check the actionElement rather than the targetElement.
  if (eventInfo['actionElement'].tagName == goog.dom.TagName.A) {
    return true;
  }
  return false;
};
