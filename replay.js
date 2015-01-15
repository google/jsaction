// Copyright 2011 Google Inc. All rights reserved.

/**
 *
 * @fileoverview Functions for replaying events by the jsaction
 * Dispatcher.
 */
goog.provide('jsaction.createKeyboardEvent');
goog.provide('jsaction.createMouseEvent');
goog.provide('jsaction.createUiEvent');
goog.provide('jsaction.replayEvent');
goog.provide('jsaction.triggerEvent');

goog.require('goog.asserts');
goog.require('goog.events.EventType');
goog.require('goog.functions');
goog.require('goog.userAgent');
goog.require('goog.userAgent.product');
goog.require('jsaction');
goog.require('jsaction.EventType');


/**
 * Replays an event.
 * @param {!jsaction.EventInfo} eventInfo The event info record.
 */
jsaction.replayEvent = function(eventInfo) {
  var event = jsaction.createEvent(eventInfo['event'], eventInfo['eventType']);
  jsaction.triggerEvent(eventInfo['targetElement'], event);
};


/**
 * Checks if a given event was triggered by the keyboard.
 * @param {string} eventType The event type.
 * @return {boolean} Whether it's a keyboard event.
 * @private
 */
jsaction.isKeyboardEvent_ = function(eventType) {
  return eventType == goog.events.EventType.KEYPRESS ||
      eventType == goog.events.EventType.KEYDOWN ||
      eventType == goog.events.EventType.KEYUP;
};


/**
 * Checks if a given event was triggered by the mouse.
 * @param {string} eventType The event type.
 * @return {boolean} Whether it's a mouse event.
 * @private
 */
jsaction.isMouseEvent_ = function(eventType) {
  // TODO(ruilopes): Verify if Drag events should be bound here.
  return eventType == goog.events.EventType.CLICK ||
      eventType == goog.events.EventType.DBLCLICK ||
      eventType == goog.events.EventType.MOUSEDOWN ||
      eventType == goog.events.EventType.MOUSEOVER ||
      eventType == goog.events.EventType.MOUSEOUT ||
      eventType == goog.events.EventType.MOUSEMOVE;
};


/**
 * Checks if a given event is a general UI event.
 * @param {string} eventType The event type.
 * @return {boolean} Whether it's a focus event.
 * @private
 */
jsaction.isUiEvent_ = function(eventType) {
  // Almost nobody supports the W3C method of creating FocusEvents.
  // For now, we're going to use the UIEvent as a super-interface.
  return eventType == goog.events.EventType.FOCUS ||
      eventType == goog.events.EventType.BLUR ||
      eventType == goog.events.EventType.FOCUSIN ||
      eventType == goog.events.EventType.FOCUSOUT ||
      eventType == goog.events.EventType.SCROLL;
};


/**
 * Create a whitespace-delineated list of modifier keys that should be
 * considered to be active on the event's key. See details at
 * https://developer.mozilla.org/en/DOM/KeyboardEvent.
 * @param {boolean} alt Alt pressed.
 * @param {boolean} ctrl Control pressed.
 * @param {boolean} meta Command pressed (OSX only).
 * @param {boolean} shift Shift pressed.
 * @return {string} The constructed modifier keys string.
 * @private
 */
jsaction.createKeyboardModifiersList_ = function(alt, ctrl, meta, shift) {
  var keys = [];
  if (alt) {
    keys.push('Alt');
  }
  if (ctrl) {
    keys.push('Control');
  }
  if (meta) {
    keys.push('Meta');
  }
  if (shift) {
    keys.push('Shift');
  }
  return keys.join(' ');
};


/**
 * Creates a UI event object for replaying through the DOM.
 * @param {!Event} original The event to create a new event from.
 * @param {string=} opt_eventType The type this event is being handled as by
 *     jsaction. E.g. blur events are handled as focusout
 * @return {!Event} The event object.
 */
jsaction.createUiEvent = function(original, opt_eventType) {
  var event;
  if (document.createEvent) {
    // Event creation as per W3C event model specification.  This codepath
    // is used by most non-IE browsers and also by IE 9 and later.
    event = document.createEvent('UIEvent');
    // On IE and Opera < 12, we must provide non-undefined values to
    // initEvent, otherwise it will fail.
    event.initUIEvent(
        opt_eventType || original.type,
        goog.isDef(original.bubbles) ? original.bubbles : true,
        original.cancelable || false,
        original.view || window,
        original.detail || 0 //detail
    );
  } else {
    goog.asserts.assert(document.createEventObject);
    // Older versions of IE (up to version 8) do not support the
    // W3C event model. Use the IE specific function instead.
    event = document.createEventObject();
    event.type = opt_eventType || original.type;
    event.bubbles = goog.isDef(original.bubbles) ? original.bubbles : true;
    event.cancelable = original.cancelable || false;
    event.view = original.view || window;
    event.detail = original.detail || 0;
  }
  // Some focus events also have a nullable relatedTarget value which isn't
  // directly supported in the initUIEvent() method.
  event.relatedTarget = original.relatedTarget || null;
  return event;
};

/**
 * Creates a keyboard event object for replaying through the DOM.
 * @param {!Event} original The event to create a new event from.
 * @param {string=} opt_eventType The type this event is being handled as by
 *     jsaction. E.g. a keypress is handled as click in some cases.
 * @return {!Event} The event object.
 */
jsaction.createKeyboardEvent = function(original, opt_eventType) {
  var event;
  if (goog.userAgent.OPERA || goog.userAgent.product.SAFARI) {
    // Opera < 12.14 doesn't support DOM Level 3 events in all of its extent.
    // Opera 12.15 supports DOM Level 3 events, but not the initKeyboardEvent
    // used below.
    // Thus, we must fallback to a generic DOM event to trigger a keyboard
    // event.  See details at
    // http://my.opera.com/community/forums/topic.dml?id=185375.
    // TODO(ruilopes): Revisit this once logs show we don't need to support
    // older Opera versions.
    //
    // We also have to fall back to a generic event for Safari, which has the
    // Webkit keyCode bug noted below, but is also incapable of fixing it with
    // Object.defineProperty due to another bug:
    // https://bugs.webkit.org/show_bug.cgi?id=36423
    event = jsaction.createGenericEvent_(original, opt_eventType);
    event.ctrlKey = original.ctrlKey;
    event.altKey = original.altKey;
    event.shiftKey = original.shiftKey;
    event.metaKey = original.metaKey;
    event.keyCode = original.keyCode;
    event.charCode = original.charCode;
    return event;
  }
  if (document.createEvent) {
    // Event creation as per W3C event model specification.  This codepath
    // is used by most non-IE browsers and also by IE 9 and later.
    event = document.createEvent('KeyboardEvent');
    if (event.initKeyboardEvent) {
      // W3C DOM Level 3 Events model.
      var modifiers = jsaction.createKeyboardModifiersList_(original.altKey,
          original.ctrlKey, original.metaKey, original.shiftKey);
      event.initKeyboardEvent(
          opt_eventType || original.type,
          true,
          true,
          window,
          original.charCode,
          original.keyCode,
          original.location,
          modifiers,
          original.repeat,
          original.locale);

      // Blink and Webkit have a long-standing bug that causes the 'keyCode' and
      // 'which' properties to always be set to 0 when synthesizing a keyboard
      // event. Details at: https://bugs.webkit.org/show_bug.cgi?id=16735
      // It unfortunately looks like IE9+ also copied this behavior, when they
      // implemented DOM3 events.  We work around it by redefining the noted
      // properties; a simple assignment here would fail because the native
      // properties are readonly.
      if (goog.userAgent.WEBKIT ||
          (goog.userAgent.IE && goog.userAgent.isVersionOrHigher('9.0'))) {
        var keyCodeGetter = goog.functions.constant(original.keyCode);
        Object.defineProperty(event, 'keyCode', {
          get: keyCodeGetter
        });
        Object.defineProperty(event, 'which', {
          get: keyCodeGetter
        });
      }

    } else {
      // Gecko only supports an older/deprecated version from DOM Level 2. See
      // https://developer.mozilla.org/en/DOM/event.initKeyEvent for details.
      goog.asserts.assert(event.initKeyEvent);
      event.initKeyEvent(
          opt_eventType || original.type,
          true,
          true,
          window,
          original.ctrlKey,
          original.altKey,
          original.shiftKey,
          original.metaKey,
          original.keyCode,
          original.charCode);
    }
  } else {
    // Older versions of IE (up to version 8) do not support the
    // W3C event model. Use the IE specific function instead.
    goog.asserts.assert(document.createEventObject);
    event = document.createEventObject();
    event.type = opt_eventType || original.type;
    event.repeat = original.repeat;
    event.ctrlKey = original.ctrlKey;
    event.altKey = original.altKey;
    event.shiftKey = original.shiftKey;
    event.metaKey = original.metaKey;
    event.keyCode = original.keyCode;
    event.charCode = original.charCode;
  }
  return event;
};


/**
 * Creates a mouse event object for replaying through the DOM.
 * @param {!Event} original The event to create a new event from.
 * @param {string=} opt_eventType The type this event is being handled as by
 *     jsaction. E.g. a keypress is handled as click in some cases.
 * @return {!MouseEvent} The event object.
 */
jsaction.createMouseEvent = function(original, opt_eventType) {
  var event;
  if (document.createEvent) {
    // Event creation as per W3C event model specification.  This codepath
    // is used by most non-IE browsers and also by IE 9 and later.
    event = document.createEvent('MouseEvent');
    // On IE and Opera < 12, we must provide non-undefined values to
    // initMouseEvent, otherwise it will fail.
    event.initMouseEvent(
        opt_eventType || original.type,
        true,  // canBubble
        true,  // cancelable
        window,
        original.detail || 1,
        original.screenX || 0,
        original.screenY || 0,
        original.clientX || 0,
        original.clientY || 0,
        original.ctrlKey || false,
        original.altKey || false,
        original.shiftKey || false,
        original.metaKey || false,
        original.button || 0,
        original.relatedTarget || null);

  } else {
    goog.asserts.assert(document.createEventObject);
    // Older versions of IE (up to version 8) do not support the
    // W3C event model. Use the IE specific function instead.
    event = document.createEventObject();
    event.type = opt_eventType || original.type;
    event.clientX = original.clientX;
    event.clientY = original.clientY;
    event.button = original.button;
    event.detail = original.detail;
    event.ctrlKey = original.ctrlKey;
    event.altKey = original.altKey;
    event.shiftKey = original.shiftKey;
    event.metaKey = original.metaKey;
  }
  return event;
};


/**
 * Creates a generic event object for replaying through the DOM.
 * @param {!Event} original The event to create a new event from.
 * @param {string=} opt_eventType The type this event is being handled as by
 *     jsaction. E.g. a keypress is handled as click in some cases.
 * @return {!Event} The event object.
 * @private
 */
jsaction.createGenericEvent_ = function(original, opt_eventType) {
  var event;
  if (document.createEvent) {
    // Event creation as per W3C event model specification.  This codepath
    // is used by most non-IE browsers and also by IE 9 and later.
    event = document.createEvent('Event');
    event.initEvent(
        opt_eventType || original.type,
        true,
        true);
  } else {
    // Older versions of IE (up to version 8) do not support the
    // W3C event model. Use the IE specific function instead.
    goog.asserts.assert(document.createEventObject);
    event = document.createEventObject();
    event.type = opt_eventType || original.type;
  }
  return event;
};


/**
 * Creates an event object for replaying through the DOM.
 * NOTE(ruilopes): This function is visible just for testing.  Please don't use
 * it outside JsAction internal testing.
 * TODO(ruilopes): Add support for FocusEvent and WheelEvent.
 * @param {!Event} original The event to create a new event from.
 * @param {string=} opt_eventType The type this event is being handled as by
 *     jsaction. E.g. a keypress is handled as click in some cases.
 * @return {!Event} The event object.
 */
jsaction.createEvent = function(original, opt_eventType) {
  var event;
  var eventType;
  if (original.type == jsaction.EventType.CUSTOM) {
    eventType = jsaction.EventType.CUSTOM;
  } else {
    eventType = opt_eventType || original.type;
  }

  if (jsaction.isKeyboardEvent_(eventType)) {
    event = jsaction.createKeyboardEvent(original, opt_eventType);
  } else if (jsaction.isMouseEvent_(eventType)) {
    event = jsaction.createMouseEvent(original, opt_eventType);
  } else if (jsaction.isUiEvent_(eventType)) {
    event = jsaction.createUiEvent(original, opt_eventType);
  } else if (eventType == jsaction.EventType.CUSTOM) {
    goog.asserts.assert(opt_eventType);
    event = jsaction.createCustomEvent(
        opt_eventType, original['detail']['data']);
  } else {
    // This ensures we don't send an undefined event object to the replayer.
    event = jsaction.createGenericEvent_(original, opt_eventType);
  }
  return event;
};


/**
 * Sends an event for replay to the DOM.
 * @param {!EventTarget} target The target for the event.
 * @param {!Event} event The event object.
 * @return {boolean} The return value of the event replay, i.e., whether
 *     preventDefault() was called on it.
 */
jsaction.triggerEvent = function(target, event) {
  if (target.dispatchEvent) {
    return target.dispatchEvent(event);
  } else {
    goog.asserts.assert(target.fireEvent);
    return target.fireEvent('on' + event.type, event);
  }
};
