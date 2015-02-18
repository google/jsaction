goog.provide('jsaction.testing.CustomEventsTest');
goog.setTestOnly('jsaction.testing.CustomEventsTest');

goog.require('goog.testing.jsunit');
goog.require('goog.testing.recordFunction');
goog.require('jsaction');
goog.require('jsaction.testing.CustomEvents');


var customEvents;
var container;
var origin;


function setUpPage() {
  container = document.getElementById('container');
  origin = document.getElementById('origin');
}


function setUp() {
  customEvents = new jsaction.testing.CustomEvents();
}


function tearDown() {
  customEvents.dispose();
}


function testSimpleListen() {
  var handlerA = goog.testing.recordFunction();
  var handlerB = goog.testing.recordFunction();
  customEvents.listen(container, 'custom_a', handlerA);
  customEvents.listen(container, 'custom_b', handlerB);

  jsaction.fireCustomEvent(origin, 'custom_a');
  handlerA.assertCallCount(1);
  handlerB.assertCallCount(0);
  handlerA.reset();

  jsaction.fireCustomEvent(origin, 'custom_b');
  handlerA.assertCallCount(0);
  handlerB.assertCallCount(1);
}


function testMultiListen() {
  var handler1 = goog.testing.recordFunction();
  var handler2 = goog.testing.recordFunction();
  customEvents.listen(container, 'custom_a', handler1);
  customEvents.listen(container, 'custom_a', handler2);

  jsaction.fireCustomEvent(origin, 'custom_a');
  handler1.assertCallCount(1);
  handler2.assertCallCount(1);
}


function testListenWithContextAndData() {
  var context = {
    expected: 1,

    handler: goog.testing.recordFunction(function(actionFlow) {
      assertEquals(this.expected, actionFlow.event().detail.data['x']);
    })
  };

  customEvents.listen(container, 'custom_a', context.handler, context);

  jsaction.fireCustomEvent(origin, 'custom_a', {'x': 1});
  context.handler.assertCallCount(1);
}


function testDispose() {
  var handler = goog.testing.recordFunction();
  customEvents.listen(container, 'custom_a', handler);

  jsaction.fireCustomEvent(origin, 'custom_a');
  handler.assertCallCount(1);
  handler.reset();

  jsaction.fireCustomEvent(origin, 'custom_a');
  handler.assertCallCount(1);
  handler.reset();

  customEvents.dispose();
  jsaction.fireCustomEvent(origin, 'custom_a');
  handler.assertCallCount(0);
}
