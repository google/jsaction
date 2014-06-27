// Copyright 2011 Google Inc. All rights reserved.

/**
 */

/** @suppress {extraProvide} */
goog.provide('jsaction.eventTest');
goog.setTestOnly('jsaction.eventTest');

goog.require('goog.functions');
goog.require('goog.testing.PropertyReplacer');
goog.require('goog.testing.events.Event');
goog.require('goog.testing.jsunit');
goog.require('jsaction.EventType');
goog.require('jsaction.KeyCodes');
goog.require('jsaction.event');


var stubs = new goog.testing.PropertyReplacer();

function DivMock() {
  this.listeners = [];
}


DivMock.prototype.addEventListener = function(event, handler, capture) {
  this.listeners.push([0, event, handler, capture]);
};


DivMock.prototype.attachEvent = function(event, handler) {
  this.listeners.push([1, event, handler]);
};


var div_ = null;
var validTarget = document.createElement('div');
validTarget.setAttribute('role', 'button');
var invalidTarget = document.createElement('div');
var roleTarget = document.createElement('div');
roleTarget.setAttribute('role', 'textbox');


function setUp() {
  div_ = new DivMock;
}


function tearDown() {
  stubs.reset();
}


function testAddEventListenerW3C() {
  var eventInfo = jsaction.event.addEventListener(
      div_, 'click', goog.nullFunction);
  assertEquals('click', eventInfo.eventType);
  assertFalse(eventInfo.capture);
}


function testAddEventListenerIE() {
  div_.addEventListener = null;
  var handlerThis = null;
  var handler = function() {
    handlerThis = this;
  };

  var eventInfo = jsaction.event.addEventListener(div_, 'click', handler);
  assertEquals('click', eventInfo.eventType);
  assertFalse(handler == eventInfo.handler);

  eventInfo.handler();
  assertEquals(div_, handlerThis);
}


function testAddEventListenerFocusW3C() {
  var eventInfo = jsaction.event.addEventListener(
      div_, 'focus', goog.nullFunction);
  assertEquals('focus', eventInfo.eventType);
  assertTrue(eventInfo.capture);
}


function testAddEventListenerBlurW3C() {
  var eventInfo = jsaction.event.addEventListener(
      div_, 'blur', goog.nullFunction);
  assertEquals('blur', eventInfo.eventType);
  assertTrue(eventInfo.capture);
}


function testAddEventListenerErrorW3C() {
  var eventInfo = jsaction.event.addEventListener(
      div_, 'error', goog.nullFunction);
  assertEquals('error', eventInfo.eventType);
  assertTrue(eventInfo.capture);
}


function testAddEventListenerLoadW3C() {
  var eventInfo = jsaction.event.addEventListener(
      div_, 'load', goog.nullFunction);
  assertEquals('load', eventInfo.eventType);
  assertTrue(eventInfo.capture);
}


function testAddEventListenerFocusIE() {
  div_.addEventListener = null;
  var eventInfo = jsaction.event.addEventListener(
      div_, 'focus', goog.nullFunction);
  assertEquals('focusin', eventInfo.eventType);
}


function testAddEventListenerBlurIE() {
  div_.addEventListener = null;
  var eventInfo = jsaction.event.addEventListener(
      div_, 'blur', goog.nullFunction);
  assertEquals('focusout', eventInfo.eventType);
}


function testIsModifiedClickEventMacMetaKey() {
  var event = {metaKey: true};
  jsaction.event.isMac_ = true;
  assertTrue(jsaction.event.isModifiedClickEvent(event));
}


function testIsModifiedClickEventNonMacCtrlKey() {
  var event = {ctrlKey: true};
  jsaction.event.isMac_ = false;
  assertTrue(jsaction.event.isModifiedClickEvent(event));
}


function testIsModifiedClickEventMiddleClick() {
  var event = {which: 2};
  assertTrue(jsaction.event.isModifiedClickEvent(event));
}


function testIsModifiedClickEventMiddleClickIE() {
  var event = {button: 4};
  assertTrue(jsaction.event.isModifiedClickEvent(event));
}


function testIsModifiedClickEventShiftKey() {
  var event = {shiftKey: true};
  assertTrue(jsaction.event.isModifiedClickEvent(event));
}


function testIsValidActionKeyTarget() {
  var div = document.createElement('div');
  div.setAttribute('role', 'checkbox');
  var textarea = document.createElement('textarea');
  var input = document.createElement('input');
  input.type = 'password';
  assertTrue(jsaction.event.isValidActionKeyTarget_(div));
  assertFalse(jsaction.event.isValidActionKeyTarget_(textarea));
  assertFalse(jsaction.event.isValidActionKeyTarget_(input));
  input.setAttribute('role', 'combobox');
  assertEquals('combobox', input.getAttribute('role'));
  assertFalse(jsaction.event.isValidActionKeyTarget_(input));
  var search = document.createElement('search');
  search.type = 'search';
  assertEquals('search', search.type);
  assertFalse(jsaction.event.isValidActionKeyTarget_(search));

  var div2 = document.createElement('div');
  // contentEditable only works on non-orphaned elements.
  document.body.appendChild(div2);
  div2.contentEditable = 'true';
  div2.setAttribute('role', 'combobox');
  assertFalse(jsaction.event.isValidActionKeyTarget_(div2));
  div2.removeAttribute('role');
  assertFalse(jsaction.event.isValidActionKeyTarget_(div2));
  div.removeAttribute('role');
  assertTrue(jsaction.event.isValidActionKeyTarget_(div));
  document.body.removeChild(div2);
}


function testIsActionKeyEventFailsOnClick() {
  var event = {
    type: 'click',
    target: validTarget
  };
  assertFalse(jsaction.event.isActionKeyEvent(event));
}


function baseIsActionKeyEvent(keyCode, opt_target, opt_originalTarget) {
  var event = {
    type: jsaction.EventType.KEYDOWN,
    which: keyCode,
    target: opt_target || validTarget,
    originalTarget: opt_originalTarget || opt_target || validTarget
  };

  stubs.set(jsaction.event, 'isValidActionKeyTarget_', goog.functions.TRUE);
  return jsaction.event.isActionKeyEvent(event);
}


function testIsActionKeyEventFailsOnInvalidKey() {
  assertFalse(baseIsActionKeyEvent(64));
}


function testIsActionKeyEventEnter() {
  assertTrue(baseIsActionKeyEvent(jsaction.KeyCodes.ENTER));
}


function testIsActionKeyEventSpace() {
  assertTrue(baseIsActionKeyEvent(jsaction.KeyCodes.SPACE));
}


function testIsActionKeyEventMacEnter() {
  if (!jsaction.event.isWebKit_) {
    return;
  }
  assertTrue(baseIsActionKeyEvent(jsaction.KeyCodes.MAC_ENTER));
}

function testIsActionKeyEventNotOriginalTarget() {
  assertTrue(baseIsActionKeyEvent(
      jsaction.KeyCodes.SPACE, document.createElement('div'), validTarget));
}

function testIsActionKeyEventNotInMap() {
  assertTrue(baseIsActionKeyEvent(
      jsaction.KeyCodes.ENTER, document.createElement('div')));
  assertFalse(baseIsActionKeyEvent(
      jsaction.KeyCodes.SPACE, document.createElement('div')));
}

function testIsMouseSpecialEventMouseenter() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  root.appendChild(child);

  var event = {
    relatedTarget: root,
    type: jsaction.EventType.MOUSEOVER,
    target: child
  };

  assertTrue(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSEENTER, child));
}

function testIsMouseSpecialEventNotMouseenter() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  root.appendChild(child);

  var event = {
    relatedTarget: child,
    type: jsaction.EventType.MOUSEOVER,
    target: root
  };

  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSEENTER, root));
  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSEENTER, child));
}

function testIsMouseSpecialEventMouseover() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  root.appendChild(child);
  var subchild = document.createElement('div');
  child.appendChild(subchild);

  var event = {
    relatedTarget: child,
    type: jsaction.EventType.MOUSEOVER,
    target: subchild
  };

  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSEENTER, root));
  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSEENTER, child));
  assertTrue(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSEENTER, subchild));
}

function testIsMouseSpecialEventMouseleave() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  root.appendChild(child);

  var event = {
    relatedTarget: root,
    type: jsaction.EventType.MOUSEOUT,
    target: child
  };

  assertTrue(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, child));
}

function testIsMouseSpecialEventNotMouseleave() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  root.appendChild(child);

  var event = {
    relatedTarget: child,
    type: jsaction.EventType.MOUSEOUT,
    target: root
  };

  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, root));
  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, child));
}

function testIsMouseSpecialEventMouseout() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  root.appendChild(child);
  var subchild = document.createElement('div');
  child.appendChild(subchild);

  var event = {
    relatedTarget: child,
    type: jsaction.EventType.MOUSEOUT,
    target: subchild
  };

  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, root));
  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, child));
  assertTrue(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, subchild));
}

function testIsMouseSpecialEventNotMouse() {
  var root = document.createElement('div');
  var child = document.createElement('div');
  root.appendChild(child);

  var event = {
    relatedTarget: root,
    type: jsaction.EventType.CLICK,
    target: child
  };

  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, child));
  assertFalse(jsaction.event.isMouseSpecialEvent(event,
      jsaction.EventType.MOUSELEAVE, child));
}

function testCreateMouseSpecialEventMouseenter() {
  var div = document.createElement('div');
  var event = new goog.testing.events.Event(jsaction.EventType.MOUSEOVER, div);
  var copiedEvent = jsaction.event.createMouseSpecialEvent(event, div);
  assertEquals(jsaction.EventType.MOUSEENTER, copiedEvent['type']);
  assertEquals(div, copiedEvent['target']);
  assertEquals(false, copiedEvent['bubbles']);
}

function testCreateMouseSpecialEventMouseleave() {
  var div = document.createElement('div');
  var event = new goog.testing.events.Event(jsaction.EventType.MOUSEOUT, div);
  var copiedEvent = jsaction.event.createMouseSpecialEvent(event, div);
  assertEquals(jsaction.EventType.MOUSELEAVE, copiedEvent['type']);
  assertEquals(div, copiedEvent['target']);
  assertEquals(false, copiedEvent['bubbles']);

}

function testMaybeCopyEvent() {
  var div = document.createElement('div');
  document.body.appendChild(div);
  var event;
  var maybeCopy;
  div.onclick = function(e) {
    event = e || window.event;
    maybeCopy = jsaction.event.maybeCopyEvent(event);
  };
  if (document.createEvent) {  // All browsers except older IEs.
    var toDispatch = document.createEvent('HTMLEvents');
    toDispatch.initEvent('click', true, true);
    div.dispatchEvent(toDispatch);
  } else {
    div.click();
  }
  assertNotNullNorUndefined(event);
  if (document.createEvent) {
    assertEquals(event, maybeCopy);
  } else {
    assertNotEquals(event, maybeCopy);
  }
  if (maybeCopy.target) {
    assertEquals(div, maybeCopy.target);
  } else {
    assertEquals(div, maybeCopy.srcElement);
  }
}


function testMaybeCopyEventDoesNotCopyNonBrowserEvent() {
  var event = {};
  var maybeCopy = jsaction.event.maybeCopyEvent(event);
  assertEquals(event, maybeCopy);
  // More browser like:
  var node = document.createElement('div');
  event = {
    type: 'click',
    target: node,
    srcElement: node
  };
  maybeCopy = jsaction.event.maybeCopyEvent(event);
  assertEquals(event, maybeCopy);
}


function testIsSpaceKeyEvent() {
  var ev = {
    target: validTarget,
    keyCode: jsaction.KeyCodes.SPACE
  };
  assertTrue(jsaction.event.isSpaceKeyEvent(ev));
  var input = goog.dom.createDom('input');
  input.type = 'checkbox';
  ev = {
    target: input,
    keyCode: jsaction.KeyCodes.SPACE
  };
  assertFalse(jsaction.event.isSpaceKeyEvent(ev));
}


function testShouldCallPreventDefaultOnNativeHtmlControl() {
  var ev = {
    target: validTarget
  };
  assertTrue(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
  ev = {
    target: invalidTarget
  };
  assertFalse(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
  ev = {
    target: roleTarget
  };
  assertFalse(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
  var button = document.createElement('button');
  ev = {
    target: button
  };
  assertTrue(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
  var input = document.createElement('input');
  input.type = 'button';
  ev = {
    target: input
  };
  assertTrue(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  ev = {
    target: checkbox
  };
  assertFalse(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
  var radio = document.createElement('input');
  radio.type = 'radio';
  ev = {
    target: radio
  };
  assertFalse(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
  var option = document.createElement('option');
  ev = {
    target: option
  };
  assertFalse(jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(ev));
}
