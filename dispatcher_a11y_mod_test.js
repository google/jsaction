goog.provide('jsaction.DispatcherA11yModTest');
goog.setTestOnly();

goog.require('goog.testing.MockControl');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers.IgnoreArgument');
goog.require('goog.testing.testSuite');
goog.require('jsaction.A11y');
goog.require('jsaction.Dispatcher');
/** @suppress {extraRequire} */
goog.require('jsaction.DispatcherA11yMod');
goog.require('jsaction.event');

const isObject = goog.testing.mockmatchers.isObject;
const mockKeydownEvent = /** @type {!Event} */ ({'type': 'keydown'});
const _ = new goog.testing.mockmatchers.IgnoreArgument();

let mockControl;

goog.testing.testSuite({
  setUp() {
    mockControl = new goog.testing.MockControl;
  },

  tearDown() {
    mockControl.$tearDown();
  },

  testMaybeResolveA11yEvent_withNonActionKeyA11yEvent_returnsSameEvent() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({eventType: 'foo'});
    const mockIsActionKey =
        mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    mockIsActionKey(_).$never();
    mockControl.$replayAll();

    const resolvedEvent = dispatcher.maybeResolveA11yEvent(eventInfo);

    assertEquals(eventInfo, resolvedEvent);
    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withA11yEvent_changesEventTypeToClick() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    mockControl.createMethodMock(jsaction.event, 'isSpaceKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(true);
    jsaction.event.isSpaceKeyEvent(mockKeydownEvent).$returns(true);
    mockControl.$replayAll();

    const resolvedEvent = dispatcher.maybeResolveA11yEvent(eventInfo);

    assertEquals('click', resolvedEvent['eventType']);
    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withSpaceKeyA11yEvent_preventsEventDefault() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    mockControl.createMethodMock(jsaction.event, 'isSpaceKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(true);
    jsaction.event.isSpaceKeyEvent(mockKeydownEvent).$returns(true);
    const mockPreventDefault =
        mockControl.createMethodMock(jsaction.event, 'preventDefault');
    mockPreventDefault(_).$once();
    mockControl.$replayAll();

    dispatcher.maybeResolveA11yEvent(eventInfo);

    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withA11yEventOnNativeElement_preventsEventDefault() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    mockControl.createMethodMock(jsaction.event, 'isSpaceKeyEvent');
    mockControl.createMethodMock(
        jsaction.event, 'shouldCallPreventDefaultOnNativeHtmlControl');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(true);
    jsaction.event.isSpaceKeyEvent(mockKeydownEvent).$returns(false);
    jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(mockKeydownEvent)
        .$returns(true);
    const mockPreventDefault =
        mockControl.createMethodMock(jsaction.event, 'preventDefault');
    mockPreventDefault(_).$once();
    mockControl.$replayAll();

    dispatcher.maybeResolveA11yEvent(eventInfo);

    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withA11yEventOnAnchorTag_preventsEventDefault() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent,
      actionElement: {tagName: 'A'},
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    mockControl.createMethodMock(jsaction.event, 'isSpaceKeyEvent');
    mockControl.createMethodMock(
        jsaction.event, 'shouldCallPreventDefaultOnNativeHtmlControl');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(true);
    jsaction.event.isSpaceKeyEvent(mockKeydownEvent).$returns(false);
    jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(mockKeydownEvent)
        .$returns(false);
    const mockPreventDefault =
        mockControl.createMethodMock(jsaction.event, 'preventDefault');
    mockPreventDefault(_).$once();
    mockControl.$replayAll();

    dispatcher.maybeResolveA11yEvent(eventInfo);

    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withGlobalA11yEventAndNoActionElement_doesNotPreventDefault() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      actionElement: null,
      event: mockKeydownEvent,
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(true);
    const mockPreventDefault =
        mockControl.createMethodMock(jsaction.event, 'preventDefault');
    mockPreventDefault(_).$never();
    mockControl.$replayAll();

    dispatcher.maybeResolveA11yEvent(eventInfo, true);

    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withGlobalNonActionKeyA11yEvent_changesEventTypeToKeydown() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(false);
    mockControl.$replayAll();

    const resolvedEvent = dispatcher.maybeResolveA11yEvent(eventInfo, true);

    assertEquals('keydown', resolvedEvent['eventType']);
    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withNonActionKeyA11yEvent_getsRetriggered() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent,
      targetElement: {},
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(false);
    mockControl.$replayAll();

    const resolvedEvent = dispatcher.maybeResolveA11yEvent(eventInfo);

    assertTrue(resolvedEvent['needsRetrigger']);
    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withNonActionKeyA11yEvent_changesEventTypeToKeydown() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent,
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(false);
    mockControl.$replayAll();

    const resolvedEvent = dispatcher.maybeResolveA11yEvent(eventInfo);

    assertEquals('keydown', resolvedEvent['eventType']);
    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withA11yEventWithNoActionElement_getsRetriggered() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      actionElement: null,
      event: mockKeydownEvent,
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
    });
    const mockIsActionKeyEvent =
        mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    mockIsActionKeyEvent(_).$never();
    mockControl.$replayAll();

    const resolvedEvent = dispatcher.maybeResolveA11yEvent(eventInfo);

    assertTrue(resolvedEvent['needsRetrigger']);
    mockControl.$verifyAll();
  },

  testMaybeResolveA11yEvent_withGlobalA11yEventAndNoActionElement_changesEventTypeToClick() {
    const dispatcher = new jsaction.Dispatcher();
    const eventInfo = createEventInfo({
      actionElement: null,
      event: mockKeydownEvent,
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      targetElement: {},
    });
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(true);
    mockControl.$replayAll();

    const resolvedEvent = dispatcher.maybeResolveA11yEvent(eventInfo, true);

    assertEquals('click', resolvedEvent['eventType']);
    mockControl.$verifyAll();
  },

  testCloneEventInfoQueue_withEmptyQueue_returnsEmptyQueue() {
    const dispatcher = new jsaction.Dispatcher();

    const eventQueue = dispatcher.cloneEventInfoQueue([]);

    assertEquals(0, eventQueue.length);
  },

  testCloneEventInfoQueue_withNonActionKeyA11yEvents_returnsAllEvents() {
    const dispatcher = new jsaction.Dispatcher();
    const queue = [];
    queue.push(/** @type {!jsaction.EventInfo} */ ({
      eventType: 'click',
      action: 'fooAction',
    }));

    const clonedQueue = dispatcher.cloneEventInfoQueue(queue);

    assertEquals(1, clonedQueue.length);
    assertEquals('fooAction', clonedQueue[0]['action']);
  },

  testCloneEventInfoQueue_returnsClonedArray() {
    const dispatcher = new jsaction.Dispatcher();
    const queue = [];
    queue.push(/** @type {!jsaction.EventInfo} */ ({
      eventType: 'click',
      action: 'fooAction',
    }));

    const clonedQueue = dispatcher.cloneEventInfoQueue(queue);

    assertNotEquals(queue, clonedQueue);
  },

  testCloneEventInfoQueue_convertsMaybeA11yClicksToClicks() {
    const dispatcher = new jsaction.Dispatcher();
    const queue = [];
    const eventInfo = createEventInfo({
      eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
      event: mockKeydownEvent,
    });
    queue.push(eventInfo);
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    mockControl.createMethodMock(jsaction.event, 'isSpaceKeyEvent');
    jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(true);
    jsaction.event.isSpaceKeyEvent(mockKeydownEvent).$returns(true);
    mockControl.$replayAll();

    const clonedQueue = dispatcher.cloneEventInfoQueue(queue);

    assertEquals(1, clonedQueue.length);
    assertEquals('click', clonedQueue[0]['eventType']);
  },

  testCloneEventInfoQueue_removesAndRetriggersNonActionKeyA11yEvents() {
    const dispatcher = new jsaction.Dispatcher();
    const queue = [];
    const numEventsToSimulate = 2;
    const mockReplayEvent =
        mockControl.createMethodMock(jsaction, 'replayEvent');
    mockReplayEvent(_).$times(numEventsToSimulate);
    mockControl.createMethodMock(jsaction.event, 'isActionKeyEvent');
    for (let i = 0; i < numEventsToSimulate; i++) {
      queue.push(createEventInfo({
        eventType: jsaction.A11y.MAYBE_CLICK_EVENT_TYPE,
        event: mockKeydownEvent
      }));
      jsaction.event.isActionKeyEvent(mockKeydownEvent).$returns(false);
    }
    mockControl.$replayAll();

    const clonedQueue = dispatcher.cloneEventInfoQueue(queue);

    assertEquals(0, clonedQueue.length);
    mockControl.$verifyAll();
  },
});

/**
 * Creates a jsaction.EventInfo object that can be used for testing.
 *
 * @param {!Object=} eventInfo
 * @return {!jsaction.EventInfo}
 */
function createEventInfo({
  eventType = 'click',
  event = undefined,
  targetElement = undefined,
  action = null,
  actionElement = 'el',
  timeStamp = Date.now(),
} = {}) {
  return /** @type {!jsaction.EventInfo} */ (
      {eventType, event, targetElement, action, actionElement, timeStamp});
}
