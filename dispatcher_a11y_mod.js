/**
 * @mods {jsaction.Dispatcher}
 * @modName {a11yInDispatcherMod}
 */
goog.provide('jsaction.DispatcherA11yMod');

goog.require('goog.dom.TagName');
goog.require('goog.object');
goog.require('jsaction.A11y');
goog.require('jsaction.Dispatcher');
goog.require('jsaction.EventType');
goog.require('jsaction.event');
goog.require('jsaction.replayEvent');


/**
 * Makes a shallow copy of the EventInfo queue, where any MAYBE_CLICK_EVENT_TYPE
 * typed events get their type converted to CLICK or KEYDOWN.
 * Because clients of jsaction must provide their own implementation of how to
 * replay queued events, this removes the need for those clients to know how to
 * handle MAYBE_CLICK_EVENT_TYPE events.
 *
 * @param {!Array<!jsaction.EventInfo>} eventInfoQueue
 * @return {!Array<!jsaction.EventInfo>}
 * @suppress {duplicate}
 */
jsaction.Dispatcher.prototype.cloneEventInfoQueue = function(eventInfoQueue) {
  const resolvedEventInfoQueue = [];
  for (let i = 0; i < eventInfoQueue.length; i++) {
    const resolvedEventInfo = this.maybeResolveA11yEvent(eventInfoQueue[i]);
    if (resolvedEventInfo['needsRetrigger']) {
      // Normally the event contract will check for the needsRetrigger value
      // after a dispatch, but in the case of replaying a queue, the replay
      // function decides how to handle each eventInfo without going through the
      // event contract. Since these events need to have the appropriate action
      // for them found, we will replay them so that they can be caught and
      // handled by the contract.
      jsaction.replayEvent(resolvedEventInfo);
    } else {
      resolvedEventInfoQueue.push(resolvedEventInfo);
    }
  }

  return resolvedEventInfoQueue;
};


/**
 * If a 'MAYBE_CLICK_EVENT_TYPE' event was dispatched, updates the eventType to
 * either click or keydown based on whether the keydown action can be treated as
 * a click. For MAYBE_CLICK_EVENT_TYPE events that are just keydowns, we set
 * flags on the event object so that the event contract does't try to dispatch
 * it as a MAYBE_CLICK_EVENT_TYPE again.
 *
 * @param {!jsaction.EventInfo} eventInfo
 * @param {boolean=} isGlobalDispatch Whether the eventInfo is meant to be
 *     dispatched to the global handlers.
 * @return {!jsaction.EventInfo} Returns a jsaction.EventInfo object with the
 *     MAYBE_CLICK_EVENT_TYPE converted to CLICK or KEYDOWN.
 * @suppress {duplicate}
 */
jsaction.Dispatcher.prototype.maybeResolveA11yEvent = function(
    eventInfo, isGlobalDispatch = false) {
  if (eventInfo['eventType'] !== jsaction.A11y.MAYBE_CLICK_EVENT_TYPE) {
    return eventInfo;
  }

  const /** !jsaction.EventInfo */ eventInfoCopy =
      /** @type {!jsaction.EventInfo} */ (goog.object.clone(eventInfo));
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
  } else {
    // Otherwise, if the keydown can't be treated as a click, we need to
    // retrigger it because now we need to look for 'keydown' actions instead.
    eventInfoCopy['eventType'] = jsaction.EventType.KEYDOWN;
    if (!isGlobalDispatch) {
      const eventCopy = jsaction.event.maybeCopyEvent(event);
      // This prevents the event contract from setting the
      // jsaction.A11y.MAYBE_CLICK_EVENT_TYPE type for Keydown events.
      eventCopy[jsaction.A11y.SKIP_A11Y_CHECK] = true;
      // Since globally dispatched events will get handled by the dispatcher,
      // don't have the event contract dispatch it again.
      eventCopy[jsaction.A11y.SKIP_GLOBAL_DISPATCH] = true;
      eventInfoCopy['event'] = eventCopy;
      // Cancels the dispatch early and tells the dispatcher to send this event
      // back to the event contract.
      eventInfoCopy['needsRetrigger'] = true;
    }
  }
  return eventInfoCopy;
};

/**
 * Returns true if the given key event can be treated as a 'click'.
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
