// Copyright 2012 Google Inc. All Rights Reserved.
// Author: ruilopes@google.com (Rui do Nascimento Dias Lopes)

/** @suppress {extraProvide} */
goog.provide('jsaction.replayEventTest');
goog.setTestOnly('jsaction.replayEventTest');

goog.require('goog.events.EventType');
goog.require('goog.testing.jsunit');
goog.require('jsaction.replayEvent');


var mockEvent = {
  type: 'click',
  detail: 1,
  screenX: 0,
  screenY: 0,
  clientX: 0,
  clientY: 0,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  button: 0,
  relatedTarget: null
};


function createEventArrayForTypes(eventTypes) {
  var events = [];
  for (var i = 0; i < eventTypes.length; ++i) {
    events.push({'type': eventTypes[i]});
  }
  return events;
}


function testIsUiEvent() {
  var uiEventTypes = [
    goog.events.EventType.BLUR,
    goog.events.EventType.FOCUS,
    goog.events.EventType.FOCUSIN,
    goog.events.EventType.FOCUSOUT,
    goog.events.EventType.SCROLL
  ];
  var uiEvents = createEventArrayForTypes(uiEventTypes);
  for (var i = 0; i < uiEvents.length; ++i) {
    assertTrue(jsaction.isUiEvent_(uiEvents[i].type));
  }
  assertFalse(jsaction.isUiEvent_(
      {'type': goog.events.EventType.KEYUP}));
}


function testIsKeyboardEvent() {
  var keyboardEventTypes = [
    goog.events.EventType.KEYPRESS,
    goog.events.EventType.KEYDOWN,
    goog.events.EventType.KEYUP
  ];
  var keyboardEvents = createEventArrayForTypes(keyboardEventTypes);
  for (var i = 0; i < keyboardEvents.length; ++i) {
    assertTrue(jsaction.isKeyboardEvent_(keyboardEvents[i].type));
  }
  assertFalse(jsaction.isKeyboardEvent_(goog.events.EventType.MOUSEDOWN));
}


function testIsMouseEvent() {
  var mouseEventTypes = [
    goog.events.EventType.CLICK,
    goog.events.EventType.DBLCLICK,
    goog.events.EventType.MOUSEDOWN,
    goog.events.EventType.MOUSEOVER,
    goog.events.EventType.MOUSEOUT,
    goog.events.EventType.MOUSEMOVE
  ];
  var mouseEvents = createEventArrayForTypes(mouseEventTypes);
  for (var i = 0; i < mouseEvents.length; ++i) {
    assertTrue(jsaction.isMouseEvent_(mouseEvents[i].type));
  }
  assertFalse(jsaction.isMouseEvent_(
      {'type': goog.events.EventType.KEYUP}));
}


function testCreateUiEvent() {
  var event = {
    'type': goog.events.EventType.BLUR,
    'bubbles': false,
    'cancelable': false,
    'view' : window,
    'detail': 0,
    'relatedTarget': null
  };
  var nativeEvent = jsaction.createUiEvent(event);
  assertEquals(event.type, nativeEvent.type);
  assertEquals(event.bubbles, nativeEvent.bubbles);
  assertEquals(event.cancelable, nativeEvent.cancelable);
  assertEquals(event.view, nativeEvent.view);
  assertEquals(event.detail, nativeEvent.detail);
  assertEquals(event.relatedTarget, nativeEvent.relatedTarget);
}


function testCreateKeyboardModifiersList() {
  assertEquals('Alt Control Meta Shift',
      jsaction.createKeyboardModifiersList_(true, true, true, true));
  assertEquals('',
      jsaction.createKeyboardModifiersList_(false, false, false, false));
  assertEquals('Alt',
      jsaction.createKeyboardModifiersList_(true, false, false, false));
  assertEquals('Meta',
      jsaction.createKeyboardModifiersList_(false, false, true, false));
}


function testCreateKeyboardEvent() {
  var event = {
    'type': goog.events.EventType.KEYPRESS,
    'charCode': 13,
    'keyCode': 13,
    'location': 0,
    'modifiers': '',
    'repeat': false,
    'locale': '',
    'ctrlKey': false,
    'altKey': false,
    'shiftKey': false,
    'metaKey': false
  };
  var nativeEvent = jsaction.createKeyboardEvent(event);
  assertEquals(event.keyCode, nativeEvent.keyCode);
  assertEquals(event.type, nativeEvent.type);
}


function testCreateMouseEvent() {
  var event = {
    'type': goog.events.EventType.MOUSEDOWN,
    'detail': 0,
    'screenX': 0,
    'screenY': 0,
    'clientX': 0,
    'clientY': 0,
    'ctrlKey': false,
    'altKey': false,
    'shiftKey': false,
    'metaKey': false,
    'button': 0,
    'relatedTarget': null
  };
  assertEquals(event.type, jsaction.createMouseEvent(event).type);
}


function testCreateGenericEvent() {
  var event = {'type': goog.events.EventType.UNLOAD};
  assertEquals(event.type, jsaction.createGenericEvent_(event).type);
}


function testCreateEvent() {
  var event = {
    'type': goog.events.EventType.MOUSEDOWN,
    'detail': 0,
    'screenX': 0,
    'screenY': 0,
    'clientX': 0,
    'clientY': 0,
    'ctrlKey': false,
    'altKey': false,
    'shiftKey': false,
    'metaKey': false,
    'button': 0,
    'relatedTarget': null
  };
  assertEquals(event.type, jsaction.createEvent(event).type);
}


function testTriggerEventWithDispatchEvent() {
  var dispatchEventCalled = false;
  var eventPassed = {'type': 'FOOBAR'};
  var elem = {};
  elem.dispatchEvent = function(event) {
    dispatchEventCalled = true;
    assertEquals(eventPassed, event);
    return false;
  };
  assertFalse(jsaction.triggerEvent(elem, eventPassed));
  assertTrue(dispatchEventCalled);
}


function testTriggerEventWithFireEvent() {
  var fireEventCalled = false;
  var eventPassed = {'type': 'FOOBAR'};
  var elem = {};
  elem.fireEvent = function(eventType, event) {
    fireEventCalled = true;
    assertEquals('onFOOBAR', eventType);
    assertEquals(eventPassed, event);
    return false;
  };
  assertFalse(jsaction.triggerEvent(elem, eventPassed));
  assertTrue(fireEventCalled);
}


function testReplayEvent() {
  var onclickCalled = false;
  document.body.onclick = function() {
    onclickCalled = true;
  };
  var event = jsaction.createEvent(mockEvent);
  eventInfo = {
    'event': event,
    'targetElement': document.body
  };
  jsaction.replayEvent(eventInfo);
  assertTrue(onclickCalled);
  document.body.onclick = null;
}
