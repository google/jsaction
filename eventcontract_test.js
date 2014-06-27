// Copyright 2007 Google Inc. All rights reserved.

/**
 */

/** @suppress {extraProvide} */
goog.provide('jsaction.EventContractTest');
goog.setTestOnly('jsaction.EventContractTest');

goog.require('goog.testing.MockClock');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.events.Event');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.require('goog.testing.mockmatchers.IgnoreArgument');
goog.require('goog.testing.mockmatchers.SaveArgument');
goog.require('goog.testing.recordFunction');
goog.require('goog.userAgent');
goog.require('jsaction');
goog.require('jsaction.Attribute');
goog.require('jsaction.EventContract');
goog.require('jsaction.EventType');
goog.require('jsaction.Property');
goog.require('jsaction.event');
goog.require('jsaction.replayEvent');



var mockClock_;
var mockControl_;
var isFunction_ = goog.testing.mockmatchers.isFunction;
var SaveArgument_ = goog.testing.mockmatchers.SaveArgument;

function setUp() {
  mockControl_ = new goog.testing.MockControl;
  mockClock_ = new goog.testing.MockClock(true);
  jsaction.EventContract.USE_EVENT_PATH = true;
  jsaction.EventContract.A11Y_CLICK_SUPPORT = true;
  jsaction.EventContract.MOUSE_SPECIAL_SUPPORT = true;
  jsaction.EventContract.STOP_PROPAGATION = true;
  jsaction.EventContract.FAST_CLICK_SUPPORT = true;
}


function tearDown() {
  mockControl_.$tearDown();
  mockClock_.dispose();
  jsaction.EventContract.resetFastClickNode_();
  jsaction.EventContract.CUSTOM_EVENT_SUPPORT = false;
}


function elem(id) {
  return document.getElementById(id);
}


function createElement(tag) {
  return document.createElement(tag);
}


function testAddContainerInstallsHandlersForRegisteredEvents() {
  var container = elem('container2');
  var mockAddEvent = mockControl_.createMethodMock(
      jsaction.event, 'addEventListener');

  // TODO(user): Use jsaction.testing.nativeEvents here instead of mocks.
  mockAddEvent(container, jsaction.EventType.CLICK, isFunction_);
  mockAddEvent(container, jsaction.EventType.KEYDOWN, isFunction_);
  // From jsaction.EventContract.FAST_CLICK
  mockAddEvent(container, jsaction.EventType.TOUCHSTART, isFunction_);
  mockAddEvent(container, jsaction.EventType.TOUCHEND, isFunction_);
  mockAddEvent(container, jsaction.EventType.TOUCHMOVE, isFunction_);
  mockAddEvent(container, 'mousemove', isFunction_);

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addEvent(jsaction.EventType.CLICK);
  e.addEvent('mousemove');
  e.addContainer(container);

  mockControl_.$verifyAll();
}


function testAddEventInstallsHandlersOnExistingContainers() {
  var container1 = elem('container');
  var container2 = elem('container2');
  var mockAddEvent = mockControl_.createMethodMock(
      jsaction.event, 'addEventListener');

  mockAddEvent(container1, 'mousemove', isFunction_);
  mockAddEvent(container2, 'mousemove', isFunction_);

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container1);
  e.addContainer(container2);
  e.addEvent('mousemove');

  mockControl_.$verifyAll();
}


function testGetEventHandler() {
  var container = elem('container2');
  var mockAddEvent = mockControl_.createMethodMock(
      jsaction.event, 'addEventListener');

  var clickHandler = new SaveArgument_();
  var a11yClickHandler = new SaveArgument_();
  var mousemoveHandler = new SaveArgument_();

  mockAddEvent(container, jsaction.EventType.CLICK, clickHandler);
  mockAddEvent(container, jsaction.EventType.KEYDOWN, a11yClickHandler);
  mockAddEvent(container, jsaction.EventType.TOUCHSTART, isFunction_);
  mockAddEvent(container, jsaction.EventType.TOUCHEND, isFunction_);
  mockAddEvent(container, jsaction.EventType.TOUCHMOVE, isFunction_);
  mockAddEvent(container, 'mousemove', mousemoveHandler);

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addEvent(jsaction.EventType.CLICK);
  e.addEvent('mousemove');
  e.addContainer(container);
  mockControl_.$verifyAll();
  assertEquals(clickHandler.arg, e.handler(jsaction.EventType.CLICK));
  assertEquals(a11yClickHandler.arg, e.handler(jsaction.EventType.KEYDOWN));
  assertEquals(mousemoveHandler.arg, e.handler('mousemove'));
  assertUndefined(e.handler('does-not-exist'));
}


function testDispatchCallbackGetsEventInfo() {
  var container = elem('container2');
  var targetElement = elem('target2');
  var actionElement = elem('host2');

  var eventInfo = null;
  var dispatchCallback = function(ei) {
    eventInfo = ei;
  };

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent('click');
  e.dispatchTo(dispatchCallback);

  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: targetElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals('clickaction', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(targetElement, eventInfo.targetElement);
  assertEquals(actionElement, eventInfo.actionElement);

  mockControl_.$verifyAll();
}


function testJsPropertiesParsedOnActionNode() {
  var container = elem('container3');
  var targetElement = elem('target3');

  var dispatcherCalled = false;
  var actionElement = null;
  var dispatchCallback = function(eventInfo) {
    dispatcherCalled = true;
    actionElement = eventInfo.actionElement;
  };

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent('click');
  e.dispatchTo(dispatchCallback);

  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: targetElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(actionElement);
  // Check that the jsprops have been parsed.
  assertEquals('bar', actionElement['foo']);

  mockControl_.$verifyAll();
}


function testFindActionStopAtMatch() {
  var container = elem('container4');
  var target = elem('target4');

  var eventInfo = null;
  var dispatchCallback = function(ei) {
    eventInfo = ei;
  };

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent(jsaction.EventType.CLICK);
  e.dispatchTo(dispatchCallback);

  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: target,
    event: jsaction.createEvent({type: 'click'})
  });
  assertEquals('clickaction_child', eventInfo.action);

  mockControl_.$verifyAll();
}


function testFindActionStopAtMatch_EventPath() {
  var container = elem('container14');
  assertNotNull(container);
  var pathitem = elem('pathitem14');
  var target = elem('target14');

  var eventInfo = null;
  var dispatchCallback = function(ei) {
    eventInfo = ei;
  };

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent(jsaction.EventType.CLICK);
  e.dispatchTo(dispatchCallback);

  var event = jsaction.createEvent(
      {type: 'click',
       path: [target, pathitem, container]});
  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: target,
    event: event
  });
  assertEquals('action14', eventInfo.action);

  mockControl_.$verifyAll();
}


function testFindActionStopAtMatchWithOwner_EventPath() {
  var container = elem('container14');
  var pathitem = elem('pathitem14');
  pathitem[jsaction.Property.OWNER] = container;
  var target = elem('target14');

  var eventInfo = null;
  var dispatchCallback = function(ei) {
    eventInfo = ei;
  };

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent(jsaction.EventType.CLICK);
  e.dispatchTo(dispatchCallback);

  var event = jsaction.createEvent(
      {type: 'click',
       path: [target, pathitem, container]});
  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: target,
    event: event
  });
  assertEquals('action14', eventInfo.action);

  mockControl_.$verifyAll();
}


function testFindActionMatchOnSelfAndBubble_EventPath() {
  jsaction.EventContract.STOP_PROPAGATION = false;
  var container = elem('container15');
  assertNotNull(container);
  var pathitem = elem('pathitem15');
  var target = elem('target15');

  // TODO(user): How does one test the case where the handler
  // bubbles the event?
  var eventInfo = null;
  var dispatchCallback = function(ei) {
    eventInfo = ei;
  };

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent(jsaction.EventType.CLICK);
  e.dispatchTo(dispatchCallback);

  var event = jsaction.createEvent(
      {type: 'click',
       path: [target, pathitem, container]});
  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: target,
    event: event
  });
  assertEquals('action15', eventInfo.action);

  mockControl_.$verifyAll();
}


function testFindActionStopAtMatchOnSelf_EventPath() {
  var container = elem('container15');
  assertNotNull(container);
  var pathitem = elem('pathitem15');
  var target = elem('target15');

  var eventInfo = null;
  var dispatchCallback = function(ei) {
    eventInfo = ei;
    return false;
  };

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent(jsaction.EventType.CLICK);
  e.dispatchTo(dispatchCallback);

  var event = jsaction.createEvent(
      {type: 'click',
       path: [target, pathitem, container]});
  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: target,
    event: event
  });
  assertEquals('action15', eventInfo.action);

  mockControl_.$verifyAll();
}


function testPreventDefaultOnAnchorChild() {
  var container = elem('container6');
  var target = elem('inside_anchor6');

  var mockPreventDefault = mockControl_.createMethodMock(
      jsaction.event, 'preventDefault');
  // preventDefault should be called even if the target is not an anchor,
  // because the detected action is attached to an anchor which is a parent of
  // the target.
  mockPreventDefault(new goog.testing.mockmatchers.IgnoreArgument());
  mockControl_.$replayAll();

  var eventInfo = null;
  var dispatchCallback = function(ei) {
    eventInfo = ei;
  };

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.addEvent(jsaction.EventType.CLICK);
  e.dispatchTo(dispatchCallback);

  // Replay a fake event to trigger a DOM event on the target element.
  jsaction.replayEvent({
    targetElement: target,
    event: jsaction.createEvent({type: 'click'})
  });
  assertEquals('myaction', eventInfo.action);

  mockControl_.$verifyAll();
}


function testAddContainerChildOfExistingContainer() {
  var e = new jsaction.EventContract;

  assertNotNull(e.addContainer(elem('container')));
  assertNotNull(e.addContainer(elem('innercontainer')));
  assertNotNull(e.addContainer(elem('container2')));
}


function testNestedContainersWithStopPropagation() {
  jsaction.EventContract.STOP_PROPAGATION = true;
  var outerContainer = elem('outercontainer11');
  var innerContainer = elem('innercontainer11');
  var innerActionElement = elem('inneraction11');
  var outerActionElement = elem('outeraction11');

  var eventInfo = null;
  var count = 0;
  var dispatchCallback = function(ei, isGlobalHandler) {
    if (!isGlobalHandler) {
      eventInfo = ei;
      count++;
    }
  };

  var e = new jsaction.EventContract;
  // Add both the inner and outer container to the event contract.
  var outerContractContainer = e.addContainer(outerContainer);
  e.addContainer(innerContainer);
  e.addEvent('click');
  e.dispatchTo(dispatchCallback);

  // Replay a fake event to trigger a DOM event on the inner action element.
  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('inner', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(innerActionElement, eventInfo.targetElement);
  assertEquals(innerActionElement, eventInfo.actionElement);

  // Replay a fake event to trigger a DOM event on the outer action element.
  eventInfo = null;
  count = 0;
  jsaction.replayEvent({
    targetElement: outerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('outer', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(outerActionElement, eventInfo.targetElement);
  assertEquals(outerActionElement, eventInfo.actionElement);

  // Remove the outer container.
  e.removeContainer(outerContractContainer);

  // Replay a fake event to trigger a DOM event on the inner action element.
  eventInfo = null;
  count = 0;
  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('inner', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(innerActionElement, eventInfo.targetElement);
  assertEquals(innerActionElement, eventInfo.actionElement);

  // Replay a fake event to trigger a DOM event on the outer action element. The
  // outer container was removed so this should do nothing.
  eventInfo = null;
  count = 0;
  jsaction.replayEvent({
    targetElement: outerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });
  assertNull(eventInfo);
  assertEquals(0, count);
}


function testNestedContainersWithoutStopPropagation() {
  jsaction.EventContract.STOP_PROPAGATION = false;
  var outerContainer = elem('outercontainer11');
  var innerContainer = elem('innercontainer11');
  var innerActionElement = elem('inneraction11');
  var outerActionElement = elem('outeraction11');

  var eventInfo = null;
  count = 0;
  var dispatchCallback = function(ei, isGlobalHandler) {
    if (!isGlobalHandler) {
      eventInfo = ei;
      count++;
    }
  };

  var e = new jsaction.EventContract;
  // Add both the inner and outer container to the event contract.
  var outerContractContainer = e.addContainer(outerContainer);
  e.addContainer(innerContainer);
  e.addEvent('click');
  e.dispatchTo(dispatchCallback);

  // Replay a fake event to trigger a DOM event on the inner action element.
  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('inner', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(innerActionElement, eventInfo.targetElement);
  assertEquals(innerActionElement, eventInfo.actionElement);

  // Replay a fake event to trigger a DOM event on the outer action element.
  eventInfo = null;
  count = 0;
  jsaction.replayEvent({
    targetElement: outerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('outer', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(outerActionElement, eventInfo.targetElement);
  assertEquals(outerActionElement, eventInfo.actionElement);

  // Remove the outer container.
  e.removeContainer(outerContractContainer);

  // Replay a fake event to trigger a DOM event on the inner action element.
  eventInfo = null;
  count = 0;
  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('inner', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(innerActionElement, eventInfo.targetElement);
  assertEquals(innerActionElement, eventInfo.actionElement);

  // Replay a fake event to trigger a DOM event on the outer action element. The
  // outer container was removed so this should do nothing.
  eventInfo = null;
  count = 0;
  jsaction.replayEvent({
    targetElement: outerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });
  assertNull(eventInfo);
  assertEquals(0, count);
}


function testNestedContainersWithoutStopPropagation_AddOuterContainerLast() {
  jsaction.EventContract.STOP_PROPAGATION = false;
  var outerContainer = elem('outercontainer11');
  var innerContainer = elem('innercontainer11');
  var innerActionElement = elem('inneraction11');
  var outerActionElement = elem('outeraction11');

  var eventInfo = null;
  var count = 0;
  var dispatchCallback = function(ei, isGlobalHandler) {
    if (!isGlobalHandler) {
      eventInfo = ei;
      count++;
    }
  };

  var e = new jsaction.EventContract;
  // Add both the inner and outer container to the event contract. Add the outer
  // container last.
  var innerContractContainer = e.addContainer(innerContainer);
  var outerContractContainer = e.addContainer(outerContainer);
  e.addEvent('click');
  e.dispatchTo(dispatchCallback);

  // Replay a fake event to trigger a DOM event on the inner action element. The
  // event should only be handled once.
  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('inner', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(innerActionElement, eventInfo.targetElement);
  assertEquals(innerActionElement, eventInfo.actionElement);

  e.removeContainer(outerContractContainer);

  eventInfo = null;
  count = 0;

  // Replay a fake event to trigger a DOM event on the inner action element.
  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNotNull(eventInfo);
  assertEquals(1, count);
  assertEquals('inner', eventInfo.action);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(innerActionElement, eventInfo.targetElement);
  assertEquals(innerActionElement, eventInfo.actionElement);

  e.removeContainer(innerContractContainer);

  eventInfo = null;
  count = 0;

  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNull(eventInfo);
  assertEquals(0, count);
}


function testNestedContainersWithoutStopPropagation_RemoveContainers() {
  jsaction.EventContract.STOP_PROPAGATION = false;
  var outerContainer = elem('outercontainer11');
  var innerContainer = elem('innercontainer11');
  var innerActionElement = elem('inneraction11');
  var outerActionElement = elem('outeraction11');

  var eventInfo = null;
  var count = 0;
  var dispatchCallback = function(ei, isGlobalHandler) {
    if (!isGlobalHandler) {
      eventInfo = ei;
      count++;
    }
  };

  var e = new jsaction.EventContract;
  // Add both the inner and outer container to the event contract. Add the outer
  // container last.
  var innerContractContainer = e.addContainer(innerContainer);
  var outerContractContainer = e.addContainer(outerContainer);
  e.addEvent('click');
  e.dispatchTo(dispatchCallback);

  e.removeContainer(innerContractContainer);
  e.removeContainer(outerContractContainer);

  // Replay a fake event to trigger a DOM event on the inner action element. The
  // containers were removed so this should do nothing.
  jsaction.replayEvent({
    targetElement: innerActionElement,
    event: jsaction.createEvent({type: 'click'})
  });

  assertNull(eventInfo);
}


function testEventContractMaybeCreateEventInfoAddsTimestamp() {
  var container = elem('container10');
  var element = document.getElementById('action10-1');
  var event = {
    type: 'click',
    srcElement: element,
    target: element,
    timeStamp: 1234
  };

  mockControl_.createMethodMock(jsaction.event, 'isModifiedClickEvent');
  jsaction.event.isModifiedClickEvent(event).$returns(false);
  mockControl_.createMethodMock(jsaction.event, 'isActionKeyEvent');
  jsaction.event.isActionKeyEvent(event).$returns(false);
  mockControl_.createMethodMock(goog, 'now');
  goog.now().$returns(1234);

  mockControl_.$replayAll();
  var eventInfo = jsaction.EventContract.createEventInfo_(
      'click', event, container);
  assertEquals('click', eventInfo.eventType);
  assertEquals('action10', eventInfo.action);
  assertEquals(1234, eventInfo.timeStamp);
  mockControl_.$verifyAll();
}

function testEventContractMaybeCreateEventInfoClick() {
  var container = elem('container8');
  var element = document.getElementById('action8-1');
  var event = {
    type: 'click',
    srcElement: element,
    target: element
  };

  mockControl_.createMethodMock(jsaction.event, 'isModifiedClickEvent');
  jsaction.event.isModifiedClickEvent(event).$returns(false);
  mockControl_.createMethodMock(jsaction.event, 'isActionKeyEvent');
  jsaction.event.isActionKeyEvent(event).$returns(false);

  mockControl_.$replayAll();
  var eventInfo = jsaction.EventContract.createEventInfo_(
      'click', event, container);
  assertEquals('click', eventInfo.eventType);
  assertEquals('action8', eventInfo.action);
  mockControl_.$verifyAll();
}


function testEventContractMaybeCreateEventInfoClickMod() {
  var container = elem('container8');
  var element = document.getElementById('action8-2');
  var event = {
    type: 'click',
    srcElement: element,
    target: element
  };

  mockControl_.createMethodMock(jsaction.event, 'isModifiedClickEvent');
  jsaction.event.isModifiedClickEvent(event).$returns(true);

  mockControl_.$replayAll();
  var eventInfo = jsaction.EventContract.createEventInfo_(
      'click', event, container);
  assertEquals('clickmod', eventInfo.eventType);
  assertEquals('action8', eventInfo.action);
  mockControl_.$verifyAll();
}


function testEventContractMaybeCreateEventInfoClickKey() {
  var container = elem('container8');
  var element = document.getElementById('action8-1');
  var event = {
    type: jsaction.EventType.KEYDOWN,
    srcElement: element,
    target: element
  };

  mockControl_.createMethodMock(jsaction.event, 'isActionKeyEvent');
  jsaction.event.isActionKeyEvent(event).$returns(true);

  mockControl_.$replayAll();
  var eventInfo = jsaction.EventContract.createEventInfo_(
      jsaction.EventType.KEYDOWN, event, container);
  assertEquals('click', eventInfo.eventType);
  assertEquals('action8', eventInfo.action);
  mockControl_.$verifyAll();
}


function testEventContractMaybeCreateEventInfoKeypress() {
  var container = elem('container8');
  var element = document.getElementById('action8-3');
  var event = {
    type: jsaction.EventType.KEYDOWN,
    srcElement: element,
    target: element
  };

  mockControl_.createMethodMock(jsaction.event, 'isActionKeyEvent');
  jsaction.event.isActionKeyEvent(event).$returns(false);

  mockControl_.$replayAll();
  var eventInfo = jsaction.EventContract.createEventInfo_(
      jsaction.EventType.KEYDOWN, event, container);
  assertEquals(jsaction.EventType.KEYDOWN, eventInfo.eventType);
  assertEquals('action8', eventInfo.action);
  mockControl_.$verifyAll();
}


function testEventContractMaybeCreateEventInfoMouseenter() {
  var container = elem('container9');
  var element = document.getElementById('action9-1');
  var event = new goog.testing.events.Event(
      jsaction.EventType.MOUSEOVER, element);
  event.relatedTarget = container;

  var eventInfo = jsaction.EventContract.createEventInfo_(
      jsaction.EventType.MOUSEENTER, event, container);
  assertEquals(jsaction.EventType.MOUSEENTER, eventInfo.eventType);
  assertEquals('action9', eventInfo.action);
}

function testEventContractMaybeCreateEventInfoNotMouseenter() {
  var container = elem('container9');
  var element = document.getElementById('action9-1');
  var event = new goog.testing.events.Event(
      jsaction.EventType.MOUSEOVER, container);
  event.relatedTarget = element;

  assertNull(jsaction.EventContract.createEventInfo_(
      jsaction.EventType.MOUSEENTER, event, container).actionElement);
}


function testEventContractMaybeCreateEventInfoMouseleave() {
  var container = elem('container9');
  var element = document.getElementById('action9-2');
  var event = new goog.testing.events.Event(
      jsaction.EventType.MOUSEOUT, element);
  event.relatedTarget = container;

  var eventInfo = jsaction.EventContract.createEventInfo_(
      jsaction.EventType.MOUSELEAVE, event, container);
  assertEquals(jsaction.EventType.MOUSELEAVE, eventInfo.eventType);
  assertEquals('action9', eventInfo.action);
}

function testEventContractMaybeCreateEventInfoNotMouseleave() {
  var container = elem('container9');
  var element = document.getElementById('action9-2');
  var event = new goog.testing.events.Event(
      jsaction.EventType.MOUSEOUT, container);
  event.relatedTarget = element;

  assertNull(jsaction.EventContract.createEventInfo_(
      jsaction.EventType.MOUSELEAVE, event, container).actionElement);
}

function testEventContractMaybeCreateEventInfoFastClick() {
  var container = elem('container12');
  var element = elem('action12-1');
  var otherElement = elem('action12-2');
  var actionNode = element.parentNode;

  // Touch somewhere else, but that sequence will never terminate.
  assertNull(sendEvent(
      jsaction.EventType.TOUCHSTART, otherElement, container).actionElement);
  assertEquals(otherElement.parentNode, jsaction.EventContract.fastClickNode_);

  // Touch an element.
  assertNull(sendEvent(
      jsaction.EventType.TOUCHSTART, element, container).actionElement);
  assertEquals(actionNode, jsaction.EventContract.fastClickNode_);
  var eventInfo = sendEvent(jsaction.EventType.TOUCHEND, element, container);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
  assertEquals(jsaction.EventType.CLICK, eventInfo.event.type);
  assertNull(sendEvent(
      jsaction.EventType.CLICK, element, container).actionElement);

  // Click on something else while the other click is blocked.
  assertNotNull(sendEvent(
      jsaction.EventType.CLICK, otherElement, container).actionElement);

  mockClock_.tick(400);
  eventInfo = sendEvent(jsaction.EventType.CLICK, element, container);
  assertEquals(jsaction.EventType.CLICK, eventInfo.eventType);
}

function testEventContractMaybeCreateEventInfoFastClick_interleaved() {
  var container = elem('container12');
  var element = elem('action12-1');
  var otherElement = elem('action12-2');
  var actionNode = element.parentNode;

  assertNull(sendEvent(
      jsaction.EventType.TOUCHSTART, element, container).actionElement);
  assertEquals(element.parentNode, jsaction.EventContract.fastClickNode_);
  assertNotNull(sendEvent(
      jsaction.EventType.TOUCHEND, element, container).actionElement);

  assertNull(sendEvent(
      jsaction.EventType.TOUCHSTART, otherElement, container).actionElement);
  assertEquals(otherElement.parentNode, jsaction.EventContract.fastClickNode_);
  assertNotNull(sendEvent(
      jsaction.EventType.TOUCHEND, otherElement, container).actionElement);

  assertNull(sendEvent(
      jsaction.EventType.CLICK, element, container).actionElement);
  assertNotNull(sendEvent(
      jsaction.EventType.CLICK, element, container).actionElement);
}

function testEventContractMaybeCreateEventInfoFastClick_touchstartStopsMagic() {
  var container = elem('container12');
  var element = elem('action12-3');
  assertNotNull(sendEvent(
      jsaction.EventType.TOUCHSTART, element, container).actionElement);
  assertNull(jsaction.EventContract.fastClickNode_);
}

function testEventContractMaybeCreateEventInfoFastClick_needsClickEvent() {
  var container = elem('container12');
  var element = elem('action12-4');
  assertNull(sendEvent(
      jsaction.EventType.TOUCHSTART, element, container).actionElement);
  assertNull(jsaction.EventContract.fastClickNode_);
}

function testEventContractMaybeCreateEventInfoFastClick_touchmoveCancels() {
  var container = elem('container12');
  var element = elem('action12-1');
  sendEvent(jsaction.EventType.TOUCHSTART, element, container);
  assertEquals(element.parentNode, jsaction.EventContract.fastClickNode_);
  assertNull(sendEvent(
      jsaction.EventType.TOUCHMOVE, element, container).actionElement);
  assertNull(jsaction.EventContract.fastClickNode_);
}

function testEventContractMaybeCreateEventInfoFastClick_timesout() {
  var container = elem('container12');
  var element = elem('action12-1');
  sendEvent(jsaction.EventType.TOUCHSTART, element, container);
  assertEquals(element.parentNode, jsaction.EventContract.fastClickNode_);
  mockClock_.tick(400);
  assertNull(jsaction.EventContract.fastClickNode_);
  assertNull(sendEvent(
      jsaction.EventType.TOUCHEND, element, container).actionElement);
}

function testEventContractMaybeCreateEventInfoFastClick_specialElements() {
  assertNotNull(
      sendEvent(jsaction.EventType.TOUCHSTART, elem('text12'), container));
  assertNull(jsaction.EventContract.fastClickNode_);
  assertNotNull(
      sendEvent(jsaction.EventType.TOUCHSTART, elem('textarea12'), container));
  assertNull(jsaction.EventContract.fastClickNode_);
  assertNotNull(
      sendEvent(jsaction.EventType.TOUCHSTART, elem('search12'), container));
  assertNull(jsaction.EventContract.fastClickNode_);
  assertNotNull(
      sendEvent(jsaction.EventType.TOUCHSTART, elem('password12'), container));
  assertNull(jsaction.EventContract.fastClickNode_);
}

function testPatchTouchEventToBeClickLike() {
  var event = new goog.testing.events.Event('touchend', elem('text12'));
  event.touches = [{
    clientX: 1,
    clientY: 2,
    screenX: 3,
    screenY: 4,
    pageX: 5,
    pageY: 6
  }, {}];
  jsaction.EventContract.patchTouchEventToBeClickLike_(event);
  assertEquals('click', event.type);
  assertEquals(1, event.clientX);
  assertEquals(2, event.clientY);
  assertEquals(3, event.screenX);
  assertEquals(4, event.screenY);
  assertEquals(5, event.pageX);
  assertEquals(6, event.pageY);

  event = new goog.testing.events.Event('touchend', elem('text12'));
  event.changedTouches = [{
    clientX: 'other',
    clientY: 2,
    screenX: 3,
    screenY: 4,
    pageX: 5,
    pageY: 6
  }];
  assertEquals('touchend', event.type);
  jsaction.EventContract.patchTouchEventToBeClickLike_(event);
  assertEquals('click', event.type);
  assertEquals('other', event.clientX);
  assertEquals(2, event.clientY);
  assertEquals(3, event.screenX);
  assertEquals(4, event.screenY);
  assertEquals(5, event.pageX);
  assertEquals(6, event.pageY);
  assertEquals('touchend', event.originalEventType);

  event = new goog.testing.events.Event('touchend', elem('text12'));
  event.changedTouches = [];
  event.touches = [{
    clientX: 1
  }, {}];
  jsaction.EventContract.patchTouchEventToBeClickLike_(event);
  assertEquals('click', event.type);
  assertEquals(1, event.clientX);
}

function sendEvent(type, target, container) {
  var event = new goog.testing.events.Event(type, target);
  return jsaction.EventContract.createEventInfo_(type, event, container);
}

function testEventContractGetAction() {
  var target = elem('host5');
  var container = elem('outercontainer5');
  var action = jsaction.EventContract.defaultEventType_;
  var actionFound = jsaction.EventContract.getAction_(
      target, action, container);
  assertEquals('namespace5.clickaction', actionFound.action);
}

function testEventContractOwnerTraversal() {
  var container = elem('container8');
  var owned = elem('owned');
  var element = elem('action8-1');
  owned[jsaction.Property.OWNER] = element;

  var event = {
    type: 'click',
    srcElement: owned,
    target: owned
  };

  var eventInfo = jsaction.EventContract.createEventInfo_(
      'click', event, container);
  assertEquals('click', eventInfo.eventType);
  assertEquals('action8', eventInfo.action);
}

function testEventContractGetAction_NoCache() {
  var target = elem('action7');
  var container = elem('container7');
  var action = jsaction.EventContract.defaultEventType_;
  var actionFound = jsaction.EventContract.getAction_(
      target, action, container);
  assertEquals('namespace7.action7', actionFound.action);

  var oldName = target.getAttribute('jsaction');
  var name = 'action7updated';
  target.setAttribute('jsaction', name);
  jsaction.Cache.clear(target);
  var actionFound = jsaction.EventContract.getAction_(
      target, action, container);
  assertEquals('namespace7.' + name, actionFound.action);
  target.setAttribute('jsaction', oldName);
}


function testEventContractGetActionEmptySubstrings() {
  // Make sure that an empty substring (caused by a trailing semicolon)
  // does not overwrite the default action.
  var elem = createElement('div');
  elem.setAttribute('jsaction', 'foo;');
  var actionInfo = jsaction.EventContract.getAction_(
      elem, jsaction.EventContract.defaultEventType_, elem);
  assertEquals('foo', actionInfo.action);
}


function testEventContractGetActionClickKeyMapsToClick() {
  var elem = createElement('div');
  elem.setAttribute('jsaction', 'foo;');
  var actionInfo = jsaction.EventContract.getAction_(
      elem, 'clickkey', elem);
  assertEquals('click', actionInfo.eventType);
  assertEquals('foo', actionInfo.action);
}


function testEventContractGetActionClickMapsToClickOnlyIfNoClick() {
  var elem = createElement('div');
  elem.setAttribute('jsaction', 'clickonly:foo;');
  var actionInfo = jsaction.EventContract.getAction_(
      elem, 'click', elem);
  assertEquals('clickonly', actionInfo.eventType);
  assertEquals('foo', actionInfo.action);
}


function testEventContractGetActionClickMapsToClickIfBothClickAndClickOnly() {
  var elem = createElement('div');
  elem.setAttribute('jsaction', 'foo;clickonly:bar;');
  var actionInfo = jsaction.EventContract.getAction_(
      elem, 'click', elem);
  assertEquals('click', actionInfo.eventType);
  assertEquals('foo', actionInfo.action);
}


function testQualifiedJsActionName_AlreadyQualified() {
  var target = elem('host5');
  var bound = elem('outercontainer5');
  var qualifiedName = jsaction.EventContract.getQualifiedName_(
      'foo.bar', target, bound);
  assertEquals('foo.bar', qualifiedName);
}


function testQualifiedJsActionName_AlreadyQualified_NoCache() {
  var target = elem('action7inner');
  var bound = elem('container7');
  var name = target.getAttribute('jsaction');
  var qualifiedName = jsaction.EventContract.getQualifiedName_(
      name, target, bound);
  assertEquals(name, qualifiedName);

  var oldName = name;
  name = 'namespace7innerupdated.qualifiedaction7';
  target.setAttribute('jsaction', name);
  qualifiedName = jsaction.EventContract.getQualifiedName_(
      name, target, bound);
  assertEquals(name, qualifiedName);
  target.setAttribute('jsaction', oldName);
}


function testQualifiedJsActionName_JsNamespaceExists() {
  var target = elem('host5');
  var bound = elem('outercontainer5');
  var qualifiedName = jsaction.EventContract.getQualifiedName_(
      'foo', target, bound);
  assertEquals('namespace5.foo', qualifiedName);
}


function testQualifiedJsActionName_JsNamespaceExists_NoCache() {
  var target = elem('action7');
  var bound = elem('container7');
  var name = target.getAttribute('jsaction');
  var qualifiedName = jsaction.EventContract.getQualifiedName_(
      name, target, bound);
  assertEquals('namespace7.' + name, qualifiedName);

  var namespaceEl = elem('namespace7');
  var oldNamespace = namespaceEl.getAttribute('jsnamespace');
  var namespace = 'namespace7updated';
  namespaceEl.setAttribute('jsnamespace', namespace);
  jsaction.Cache.clearNamespace(namespaceEl);
  qualifiedName = jsaction.EventContract.getQualifiedName_(
      name, target, bound);
  assertEquals(namespace + '.' + name, qualifiedName);
  namespaceEl.setAttribute('jsnamespace', oldNamespace);
}


function testQualifiedJsActionName_NamespaceOnBoundingNode() {
  var target = elem('host5');
  var bound = elem('container5');
  var qualifiedName = jsaction.EventContract.getQualifiedName_(
      'foo', target, bound);
  assertEquals('namespace5.foo', qualifiedName);
}


function testQualifiedJsActionName_NoJsNamespace() {
  var target = elem('host5');
  var bound = elem('innercontainer5');
  var qualifiedName = jsaction.EventContract.getQualifiedName_(
      'foo', target, bound);
  assertEquals('foo', qualifiedName);
}


function testJsActionNameQualified() {
  assertTrue(jsaction.EventContract.isQualifiedName_('a.b'));
  assertFalse(jsaction.EventContract.isQualifiedName_('a'));
}


function testEventContractGetNamespace() {
  var elem = createElement('div');
  elem.setAttribute('jsnamespace', 'foo');
  assertUndefined(jsaction.Cache.getNamespace(elem));
  var jsnamespace = jsaction.EventContract.getNamespace_(elem);
  assertEquals('foo', jsnamespace);
  assertEquals('foo', jsaction.Cache.getNamespace(elem));
}


function testEventContractGetNamespace_Undefined() {
  var elem = createElement('div');
  assertUndefined(jsaction.Cache.getNamespace(elem));
  var jsnamespace = jsaction.EventContract.getNamespace_(elem);
  assertNull(jsnamespace);
  assertNull(jsaction.Cache.getNamespace(elem));
}


function testCustomEvents_DispatchedCorrectly() {
  if (goog.userAgent.IE && !goog.userAgent.isVersionOrHigher('9')) {
    // IE8 does not support custom events at all.
    return;
  }

  jsaction.EventContract.CUSTOM_EVENT_SUPPORT = true;

  var container = elem('container13');
  var targetElement = elem('target13');
  var actionElement = elem('host13');
  var dispatchCallback = goog.testing.recordFunction();

  mockControl_.$replayAll();

  var e = new jsaction.EventContract;
  e.addContainer(container);
  e.dispatchTo(dispatchCallback);

  jsaction.fireCustomEvent(targetElement, 'foo', {'bar': 4});

  // One for global handler, one for regular jsaction dispatch.
  assertEquals(2, dispatchCallback.getCallCount());
  var eventInfo = dispatchCallback.popLastCall().getArgument(0);
  assertEquals('fooaction', eventInfo.action);
  assertEquals('foo', eventInfo.eventType);
  assertEquals(4, eventInfo.event.detail.data['bar']);
  assertEquals(targetElement, eventInfo.targetElement);
  assertEquals(actionElement, eventInfo.actionElement);

  // Testing cached handler for custom events.
  jsaction.fireCustomEvent(targetElement, 'bar', {'bar': 4});

  // Two for global handler, one for regular jsaction dispatch.
  assertEquals(3, dispatchCallback.getCallCount());
  var eventInfo = dispatchCallback.popLastCall().getArgument(0);
  assertEquals('baraction', eventInfo.action);
  assertEquals('bar', eventInfo.eventType);
  assertEquals(4, eventInfo.event.detail.data['bar']);
  assertEquals(targetElement, eventInfo.targetElement);
  assertEquals(actionElement, eventInfo.actionElement);
  mockControl_.$verifyAll();
}
