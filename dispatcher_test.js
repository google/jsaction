// Copyright 2007 Google Inc. All rights reserved.

/**
 */

/** @suppress {extraProvide} */
goog.provide('jsaction.DispatcherTest');
goog.setTestOnly('jsaction.DispatcherTest');

goog.require('goog.testing.MockClock');
goog.require('goog.testing.MockControl');
goog.require('goog.testing.jsunit');
goog.require('goog.testing.mockmatchers');
goog.require('goog.testing.recordFunction');
goog.require('jsaction.ActionFlow');
goog.require('jsaction.Dispatcher');
/** @suppress {extraRequire} */
goog.require('jsaction.replayEvent');


var mockClock_;
var mockControl_;
var isObject_ = goog.testing.mockmatchers.isObject;
var isArray_ = goog.testing.mockmatchers.isArray;


function setUp() {
  mockControl_ = new goog.testing.MockControl;
  mockClock_ = new goog.testing.MockClock;
  mockClock_.install();
}


function tearDown() {
  mockControl_.$tearDown();
  mockClock_.uninstall();
}


function testDispatcherHandleAction_HandlerBound() {
  var actionHandler = mockControl_.createFunctionMock();
  var mockActionElement = document.createElement('div');
  var mockEvent = jsaction.createEvent({type: 'click'});

  var actionFlow = null;
  actionHandler(isObject_).$does(function(flow) {
    actionFlow = flow;
    actionFlow.branch('fakebranch');
  });

  mockControl_.$replayAll();

  var d = new jsaction.Dispatcher;
  var actions = {'bar': actionHandler};
  d.registerHandlers('foo', null, actions);

  d.dispatch({
    action: 'foo.bar',
    actionElement: mockActionElement,
    event: mockEvent
  });
  assertNotNull(actionFlow);
  assertEquals('foo_bar', actionFlow.getType());
  assertEquals(mockEvent.type, actionFlow.event().type);
  assertEquals(mockActionElement, actionFlow.node());

  mockControl_.$verifyAll();
}


function testDispatcherHandleAction_NoHandlerBound_CallLoader() {
  var loader = mockControl_.createFunctionMock();
  var mockEvent = jsaction.createEvent({type: 'click'});

  // The loader should get called only once.
  loader(isObject_, 'foo');

  mockControl_.$replayAll();

  var d = new jsaction.Dispatcher;
  d.registerLoader('foo', loader);

  d.dispatch({action: 'foo.bar', event: mockEvent});
  d.dispatch({action: 'foo.bar', event: mockEvent});

  mockControl_.$verifyAll();
}


function testRegisterHandlers() {
  var d = new jsaction.Dispatcher;

  // An object to whose methods we bind actions. The properties are
  // methods (hence unquoted).
  var o = {
    foo: function() {},
    bar: function() {},
    baz: function() {}
  };

  // The config which action to map to which method of o. The
  // properties are names of actions used in the value of the jsaction
  // HTML attribute (hence quoted). The difference would be
  // significant in jscompiled code.
  var m = {
    'foo': o.foo,
    'bar': o.bar
  };

  d.registerHandlers('', o, m);
  assertTrue(d.hasAction('foo'));
  assertTrue(d.hasAction('bar'));
  assertFalse(d.hasAction('baz'));


  d.registerHandlers('x', o, m);
  assertTrue(d.hasAction('x.foo'));
  assertTrue(d.hasAction('x.bar'));
  assertFalse(d.hasAction('x.baz'));
}


function testUnregisterHandlers() {
  var d = new jsaction.Dispatcher;
  var handler1Called = false;
  var handler1 = function() {
    handler1Called = true;
  };
  var handler2Called = false;
  var handler2 = function() {
    handler2Called = true;
  };

  d.registerHandlers('prefix', null, {'clickaction': handler1});
  d.registerHandlers('', null, {'fooaction': handler2});
  assertTrue(d.hasAction('prefix.clickaction'));
  assertTrue(d.hasAction('fooaction'));

  d.unregisterHandler('prefix', 'clickaction');
  assertFalse(d.hasAction('prefix.clickaction'));
  assertFalse(handler1Called);

  d.unregisterHandler('', 'fooaction');
  assertFalse(d.hasAction('fooaction'));
  assertFalse(handler2Called);
}


function testEventAreReplayedWhenQueuePassedIn() {
  var d = new jsaction.Dispatcher;
  var mockEventReplayer = mockControl_.createFunctionMock();
  var mockEvent = jsaction.createEvent({type: 'click'});
  var mockQueue = [{action: 'foo.bar', event: mockEvent}];
  var replayed = false;

  mockEventReplayer(isArray_, d).$does(function() {
    replayed = true;
  });

  mockControl_.$replayAll();

  var actions = {'bar': function() {}};
  d.registerHandlers('foo', null, actions);
  d.setEventReplayer(mockEventReplayer);

  assertFalse(replayed);

  d.dispatch(mockQueue);
  mockClock_.tick(0);

  assertTrue(replayed);

  mockControl_.$verifyAll();
}


function testEventAreReplayedWhenHandlersAreRegistered() {
  var d = new jsaction.Dispatcher;
  var mockEventReplayer = mockControl_.createFunctionMock();
  var mockEvent = jsaction.createEvent({type: 'click'});
  var mockQueue = [{action: 'foo.bar', event: mockEvent}];
  var replayed = false;

  mockEventReplayer(isArray_, d).$does(function() {
    replayed = true;
  });

  mockControl_.$replayAll();

  d.setEventReplayer(mockEventReplayer);
  d.dispatch({action: 'foo.bar', event: mockEvent});

  assertFalse(replayed);

  var actions = {'bar': function() {}};
  d.registerHandlers('foo', null, actions);
  mockClock_.tick(0);

  assertTrue(replayed);

  mockControl_.$verifyAll();
}


function testEventsAreReplayedWhenReplayerIsRegistered() {
  var d = new jsaction.Dispatcher;
  var mockEventReplayer = mockControl_.createFunctionMock();
  var mockEvent = jsaction.createEvent({type: 'click'});
  var mockQueue = [{action: 'foo.bar', event: mockEvent}];
  var replayed = false;

  mockEventReplayer(isArray_, d).$does(function() {
    replayed = true;
  });

  mockControl_.$replayAll();

  d.dispatch({action: 'foo.bar', event: mockEvent});
  var actions = {'bar': function() {}};
  d.registerHandlers('foo', null, actions);

  assertFalse(replayed);

  d.setEventReplayer(mockEventReplayer);
  mockClock_.tick(0);

  assertTrue(replayed);

  mockControl_.$verifyAll();
}


function testAlternateFlowFactory() {
  var mockEvent = jsaction.createEvent({type: 'click'});
  var eventInfo = {action: 'foo.bar', event: mockEvent};
  var mockFlowFactory = mockControl_.createFunctionMock();
  var d = new jsaction.Dispatcher(mockFlowFactory);
  var actionFlow = new jsaction.ActionFlow('foo.bar');
  var flowFactoryInvoked = false;
  mockFlowFactory(eventInfo).$does(function() {
    flowFactoryInvoked = true;
    return actionFlow;
  });

  var handled = false;
  var mockHandler = mockControl_.createFunctionMock();
  mockHandler(actionFlow).$does(function() {
    handled = true;
  });

  mockControl_.$replayAll();

  var actions = {'bar': mockHandler};
  d.registerHandlers('foo', null, actions);

  assertFalse(handled);
  assertFalse(flowFactoryInvoked);
  d.dispatch(eventInfo);
  assertTrue(handled);
  assertTrue(flowFactoryInvoked);

  mockControl_.$verifyAll();
}


function testRegisterLoader() {
  var d = new jsaction.Dispatcher;
  var mockLoader = function() {};
  d.registerLoader('foo', mockLoader);

  assertObjectEquals({'foo': {loader: mockLoader, called: false}}, d.loaders_);
}


function testRegisterDefaultLoader() {
  var d = new jsaction.Dispatcher;
  var mockEvent = jsaction.createEvent({type: 'click'});
  var mockDefaultLoaderCalled = false;
  var mockDefaultLoader = function() {
    mockDefaultLoaderCalled = true;
  };
  d.registerDefaultLoader(mockDefaultLoader);
  d.dispatch({action: 'foo.bar', event: mockEvent});

  assertTrue(mockDefaultLoaderCalled);
}


function testMaybeInvokeLoaderWithoutLoaders() {
  var d = new jsaction.Dispatcher;
  var mockEvent = jsaction.createEvent({type: 'click'});
  var mockDefaultLoaderCalled = false;
  var mockDefaultLoader = function() {
    mockDefaultLoaderCalled = true;
  };
  d.dispatch({action: 'foo.bar', event: mockEvent});

  assertFalse(mockDefaultLoaderCalled);
}


function testMaybeInvokeLoaderWithoutDefault() {
  var d = new jsaction.Dispatcher;
  var mockEvent = jsaction.createEvent({type: 'click'});
  var loaderCalled = false;
  var loaderDispatcher;
  var loaderNamespace;
  var loader = function(dispatcher, namespace) {
    loaderCalled = true;
    loaderDispatcher = dispatcher;
    loaderNamespace = namespace;
  };
  d.registerLoader('foo', loader);
  d.dispatch({action: 'foo.bar', event: mockEvent});

  assertTrue(loaderCalled);
  assertEquals(d, loaderDispatcher);
  assertEquals('foo', loaderNamespace);
}


function testMaybeInvokeLoaderWithoutDefaultButUnmatchedNamespace() {
  var d = new jsaction.Dispatcher;
  var mockEvent = jsaction.createEvent({type: 'click'});
  var loaderCalled = false;
  var loaderDispatcher;
  var loaderNamespace;
  var loader = function(dispatcher, namespace) {
    loaderCalled = true;
    loaderDispatcher = dispatcher;
    loaderNamespace = namespace;
  };
  d.registerLoader('foo', loader);
  d.dispatch({action: 'bar.baz', event: mockEvent});

  assertFalse(loaderCalled);
  assertUndefined(loaderDispatcher);
  assertUndefined(loaderNamespace);
}


function testMaybeInvokeLoaderWithoutNamespaceLoader() {
  var d = new jsaction.Dispatcher;
  var mockEvent = jsaction.createEvent({type: 'click'});
  var defaultLoaderCalled = false;
  var defaultLoaderDispatcher;
  var defaultLoaderNamespace;
  var defaultLoader = function(dispatcher, namespace) {
    defaultLoaderCalled = true;
    defaultLoaderDispatcher = dispatcher;
    defaultLoaderNamespace = namespace;
  };
  d.registerDefaultLoader(defaultLoader);
  d.dispatch({action: 'foo.bar', event: mockEvent});

  assertTrue(defaultLoaderCalled);
  assertEquals(d, defaultLoaderDispatcher);
  assertEquals('foo', defaultLoaderNamespace);
}


function testMaybeInvokeLoaderWithNamespaceLoaderAndDefault() {
  var d = new jsaction.Dispatcher;
  var mockEvent = jsaction.createEvent({type: 'click'});
  var loaderCalled = false;
  var loaderDispatcher;
  var loaderNamespace;
  var loader = function(dispatcher, namespace) {
    loaderCalled = true;
    loaderDispatcher = dispatcher;
    loaderNamespace = namespace;
  };
  d.registerLoader('foo', loader);

  var defaultLoaderCalled = false;
  var defaultLoaderDispatcher;
  var defaultLoaderNamespace;
  var defaultLoader = function(dispatcher, namespace) {
    defaultLoaderCalled = true;
    defaultLoaderDispatcher = dispatcher;
    defaultLoaderNamespace = namespace;
  };
  d.registerDefaultLoader(defaultLoader);

  d.dispatch({action: 'foo.bar', event: mockEvent});

  assertTrue(loaderCalled);
  assertEquals(d, loaderDispatcher);
  assertEquals('foo', loaderNamespace);
  assertFalse(defaultLoaderCalled);
  assertUndefined(defaultLoaderDispatcher);
  assertUndefined(defaultLoaderNamespace);
}


function testMaybeInvokeLoaderWithDefaultRunsOnlyOnce() {
  var d = new jsaction.Dispatcher;
  var mockEvent = jsaction.createEvent({type: 'click'});
  var defaultLoaderCalled = false;
  var defaultLoaderCalledTimes = 0;
  var defaultLoaderDispatcher;
  var defaultLoaderNamespace;
  var defaultLoader = function(dispatcher, namespace) {
    defaultLoaderCalled = true;
    defaultLoaderCalledTimes++;
    defaultLoaderDispatcher = dispatcher;
    defaultLoaderNamespace = namespace;
  };
  d.registerDefaultLoader(defaultLoader);
  d.dispatch({action: 'foo.bar', event: mockEvent});
  // Default loader should be skipped the second time.
  d.dispatch({action: 'foo.bar', event: mockEvent});

  assertTrue(defaultLoaderCalled);
  assertEquals(1, defaultLoaderCalledTimes);
  assertEquals(d, defaultLoaderDispatcher);
  assertEquals('foo', defaultLoaderNamespace);
}


function testNamespaceDispatcherWithAccept() {
  var handler = goog.testing.recordFunction();
  var accept = mockControl_.createFunctionMock();
  accept(isObject_).$returns(false);
  accept(isObject_).$returns(true);

  mockControl_.$replayAll();

  var d = new jsaction.Dispatcher();
  d.registerNamespaceHandler('r', handler, accept);
  assertTrue(d.hasAction('r.abcd'));

  // accept() returns false.
  var mockEvent = jsaction.createEvent({type: 'click'});
  var eventInfo = {action: 'r.abcd', event: mockEvent};
  d.dispatch(eventInfo);

  assertEquals(0, handler.getCallCount());

  // accept() returns true.
  d.dispatch(eventInfo);

  assertEquals(1, handler.getCallCount());

  mockControl_.$verifyAll();
}


function testNamespaceDispatcherWithoutAccept() {
  var handler = goog.testing.recordFunction();

  mockControl_.$replayAll();

  var d = new jsaction.Dispatcher();
  d.registerNamespaceHandler('r', handler);
  assertTrue(d.hasAction('r.abcd'));

  var mockEvent = jsaction.createEvent({type: 'click'});
  var eventInfo = {action: 'r.abcd', event: mockEvent};
  d.dispatch(eventInfo);

  assertEquals(1, handler.getCallCount());

  mockControl_.$verifyAll();
}


function testCanDispatch() {
  var d = new jsaction.Dispatcher;
  d.registerHandlers('test', null, {'foo': function() {}});
  d.registerNamespaceHandler('ns', function() {}, goog.functions.TRUE);
  d.registerNamespaceHandler('ns2', function() {}, goog.functions.FALSE);

  assertTrue(d.canDispatch({action: 'test.foo'}));
  assertFalse(d.canDispatch({action: 'test.bar'}));
  assertFalse(d.canDispatch({action: 'nohandler.baz'}));

  assertTrue(d.canDispatch({action: 'ns.foo'}));
  assertTrue(d.canDispatch({action: 'ns.bar'}));
  assertFalse(d.canDispatch({action: 'ns2.foo'}));
  assertFalse(d.canDispatch({action: 'ns2.bar'}));
}

function testGlobalDispatch() {
  var handler = goog.testing.recordFunction();

  var d = new jsaction.Dispatcher;
  d.registerGlobalHandler('click', handler);

  var mockEvent = jsaction.createEvent({type: 'click'});
  var eventInfo = {event: mockEvent, eventType: 'click'};
  d.dispatch(eventInfo, true);

  assertEquals(1, handler.getCallCount());
}

function testGlobalDispatchSkipsHandlersForDifferentEventType() {
  var handler = goog.testing.recordFunction();

  var d = new jsaction.Dispatcher;
  d.registerGlobalHandler('click', handler);

  var mockEvent = jsaction.createEvent({type: 'mousedown'});
  var eventInfo = {event: mockEvent, eventType: 'mousedown'};
  d.dispatch(eventInfo, true);

  assertEquals(0, handler.getCallCount());
}
