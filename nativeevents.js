// Copyright 2011 Google Inc. All Rights Reserved.

/**
 * @fileoverview Utility functions for generating native browser events.
 */
goog.provide('jsaction.testing.nativeEvents');
goog.setTestOnly('jsaction.testing.nativeEvents');

goog.require('goog.dom.NodeType');
goog.require('goog.events.BrowserEvent');
goog.require('goog.events.EventType');
goog.require('goog.style');
goog.require('goog.testing.events.Event');
goog.require('jsaction.createKeyboardEvent');
goog.require('jsaction.createMouseEvent');
goog.require('jsaction.triggerEvent');


/**
 * Simulates a blur event on the given target.
 * @param {EventTarget} target The target for the event.
 * @return {boolean} The returnValue of the event: false if preventDefault() was
 *     called on it, true otherwise.
 */
jsaction.testing.nativeEvents.fireBlurEvent = function(target) {
  var e = new goog.testing.events.Event(goog.events.EventType.BLUR, target);
  return jsaction.triggerEvent(target, jsaction.createFocusEvent(e));
};


/**
 * Simulates a focus event on the given target.
 * @param {EventTarget} target The target for the event.
 * @return {boolean} The returnValue of the event: false if preventDefault() was
 *     called on it, true otherwise.
 */
jsaction.testing.nativeEvents.fireFocusEvent = function(target) {
  var e = new goog.testing.events.Event(goog.events.EventType.FOCUS, target);
  return jsaction.triggerEvent(target, jsaction.createFocusEvent(e));
};


/**
 * Simulates a mousedown, mouseup, and then click on the given event target,
 * with the left mouse button.
 * @param {EventTarget} target The target for the event.
 * @param {goog.events.BrowserEvent.MouseButton=} opt_button Mouse button;
 *     defaults to {@code goog.events.BrowserEvent.MouseButton.LEFT}.
 * @return {boolean} The returnValue of the sequence: false if preventDefault()
 *     was called on any of the events, true otherwise.
 */
jsaction.testing.nativeEvents.fireClickSequence = function(target, opt_button) {
  return !!(
      jsaction.testing.nativeEvents.fireMouseDownEvent(target, opt_button) &
      jsaction.testing.nativeEvents.fireMouseUpEvent(target, opt_button) &
      jsaction.testing.nativeEvents.fireClickEvent(target, opt_button));
};


/**
 * Simulates a mousedown event on the given target.
 * @param {EventTarget} target The target for the event.
 * @param {goog.events.BrowserEvent.MouseButton=} opt_button Mouse button;
 *     defaults to {@code goog.events.BrowserEvent.MouseButton.LEFT}.
 * @return {boolean} false if preventDefault() was called, true otherwise.
 */
jsaction.testing.nativeEvents.fireMouseDownEvent = function(
    target, opt_button) {
  return jsaction.testing.nativeEvents.fireMouseButtonEvent_(
      goog.events.EventType.MOUSEDOWN, target, opt_button);
};


/**
 * Simulates a mouseup event on the given target.
 * @param {EventTarget} target The target for the event.
 * @param {goog.events.BrowserEvent.MouseButton=} opt_button Mouse button;
 *     defaults to {@code goog.events.BrowserEvent.MouseButton.LEFT}.
 * @return {boolean} false if preventDefault() was called, true otherwise.
 */
jsaction.testing.nativeEvents.fireMouseUpEvent = function(target, opt_button) {
  return jsaction.testing.nativeEvents.fireMouseButtonEvent_(
      goog.events.EventType.MOUSEUP, target, opt_button);
};


/**
 * Simulates a click event on the given target.
 * @param {EventTarget} target The target for the event.
 * @param {goog.events.BrowserEvent.MouseButton=} opt_button Mouse button;
 *     defaults to {@code goog.events.BrowserEvent.MouseButton.LEFT}.
 * @return {boolean} false if preventDefault() was called, true otherwise.
 */
jsaction.testing.nativeEvents.fireClickEvent = function(target, opt_button) {
  return jsaction.testing.nativeEvents.fireMouseButtonEvent_(
      goog.events.EventType.CLICK, target, opt_button);
};


/**
 * Simulates a mouseover event on the given target.
 * @param {EventTarget} target The target for the event.
 * @return {boolean} false if preventDefault() was called, true otherwise.
 */
jsaction.testing.nativeEvents.fireMouseOverEvent = function(target) {
  return jsaction.testing.nativeEvents.fireMouseButtonEvent_(
      goog.events.EventType.MOUSEOVER, target);
};


/**
 * Simulates a mouseout event on the given target.
 * @param {EventTarget} target The target for the event.
 * @return {boolean} false if preventDefault() was called, true otherwise.
 */
jsaction.testing.nativeEvents.fireMouseOutEvent = function(target) {
  return jsaction.testing.nativeEvents.fireMouseButtonEvent_(
      goog.events.EventType.MOUSEOUT, target);
};


/**
 * Simulates a mousemove event on the given target.
 * @param {EventTarget} target The target for the event.
 * @param {goog.math.Coordinate=} opt_coords Mouse position. Defaults to event's
 * target's position (if available), otherwise (0, 0).
 * @return {boolean} The returnValue of the event: false if preventDefault() was
 *     called on it, true otherwise.
 */
jsaction.testing.nativeEvents.fireMouseMoveEvent = function(
    target, opt_coords) {
  if (!opt_coords && target &&
      target.nodeType == goog.dom.NodeType.ELEMENT) {
    try {
      opt_coords =
          goog.style.getClientPosition(/** @type {Element} **/ (target));
    } catch (ex) {
      // IE sometimes throws if it can't get the position.
    }
  }

  var e = new goog.testing.events.Event(
      goog.events.EventType.MOUSEMOVE, target);
  var xPos = opt_coords ? opt_coords.x : 0;
  var yPos = opt_coords ? opt_coords.y : 0;
  e.clientX = e.screenX = xPos;
  e.clientY = e.screenY = yPos;

  return jsaction.triggerEvent(target, jsaction.createMouseEvent(e));
};


/**
 * Creates a mouse button event.
 * @param {string} type The event type.
 * @param {!EventTarget} target The target for the event.
 * @param {goog.events.BrowserEvent.MouseButton=} opt_button Mouse button;
 *     defaults to {@code goog.events.BrowserEvent.MouseButton.LEFT}.
 * @param {boolean=} opt_modifierKey Create the event with the modifier key
 *     registered as down.
 * @return {!Event} The created event.
 */
jsaction.testing.nativeEvents.createMouseButtonEvent = function(
    type, target, opt_button, opt_modifierKey) {
  var e = new goog.testing.events.Event(type, target);
  e.button = opt_button || goog.events.BrowserEvent.MouseButton.LEFT;
  if (opt_modifierKey) {
    e.ctrlKey = true;
    e.metaKey = true;
  }
  return jsaction.createMouseEvent(e);
};


/**
 * Helper function to fire a mouse event with a mouse button. IE < 9 only allows
 * firing events using the left mouse button.
 * @param {string} type The event type.
 * @param {EventTarget} target The target for the event.
 * @param {goog.events.BrowserEvent.MouseButton=} opt_button Mouse button;
 *     defaults to {@code goog.events.BrowserEvent.MouseButton.LEFT}.
 * @return {boolean} The value returned by the browser event,
 *     which returns false iff 'preventDefault' was invoked.
 * @private
 */
jsaction.testing.nativeEvents.fireMouseButtonEvent_ = function(
    type, target, opt_button) {
  var e = jsaction.testing.nativeEvents.createMouseButtonEvent(
      type, target, opt_button);
  return jsaction.triggerEvent(target, e);
};


/**
 * Creates and initializes a key event.
 * @param {string} eventType The type of event to create ("keydown", "keyup",
 *     or "keypress").
 * @param {HTMLElement} node The event target.
 * @param {number} keyCode The key code.
 * @param {number} charCode The character code produced by the key.
 * @return {Object} an initialized event object.
 */
jsaction.testing.nativeEvents.fireKeyEvent = function(
    eventType, node, keyCode, charCode) {
  var e = new goog.testing.events.Event(eventType, node);
  e.charCode = charCode;
  e.keyCode = keyCode;
  var nativeEvent = jsaction.createKeyboardEvent(e);
  jsaction.triggerEvent(node, nativeEvent);
  return nativeEvent;
};


/**
 * Generates a series of events simulating a key press on the given element.
 * @param {HTMLElement} node The event target.
 * @param {number} keyCode The key code.
 * @param {number} charCode The character code produced by the key.
 */
jsaction.testing.nativeEvents.simulateKeyPress = function(
    node, keyCode, charCode) {
  var e;

  e = jsaction.testing.nativeEvents.fireKeyEvent(
      goog.events.EventType.KEYDOWN, node, keyCode, charCode);
  e = jsaction.testing.nativeEvents.fireKeyEvent(
      goog.events.EventType.KEYPRESS, node, keyCode, charCode);
  e = jsaction.testing.nativeEvents.fireKeyEvent(
      goog.events.EventType.KEYUP, node, keyCode, charCode);
};
