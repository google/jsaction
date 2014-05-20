// Copyright 2008 Google Inc. All rights reserved.

/**
 */

/** @suppress {extraProvide} */
goog.provide('jsaction.ActionFlowTest');
goog.setTestOnly('jsaction.ActionFlowTest');

goog.require('goog.array');
goog.require('goog.events');
goog.require('goog.object');
goog.require('goog.testing.MockClock');
goog.require('goog.testing.jsunit');
goog.require('jsaction.Branch');
goog.require('jsaction.ActionFlow');
/** @suppress {extraRequire} */
goog.require('jsaction.replayEvent');



var mockClock_;
var reportSent;
var reportTimingData;
var reportActionData;
var reportImpressionData;
var savedGlobal_;
var iframeDocument;


function setUpPage() {
  var testHtml = '<body>' + document.body.innerHTML + '</body>';
  var iframe = document.createElement('iframe');
  iframe.src = 'about:blank';
  document.body.appendChild(iframe);
  var doc = iframe.contentWindow.document;
  doc.open();
  doc.write(testHtml);
  doc.close();
  iframeDocument = doc;
}


function setUp() {
  mockClock_ = new goog.testing.MockClock;
  mockClock_.install();

  goog.events.listen(
      jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.DONE, reportHandler);

  reportSent = false;
  reportTimingData = {};
  reportActionData = {};
  reportImpressionData = {};

  savedGlobal_ = null;
}


function tearDown() {
  mockClock_.uninstall();

  if (savedGlobal_) {
    goog.global = savedGlobal_;
  }
}


function reportHandler(e) {
  reportSent = true;
  reportTimingData['flowType'] = e.flow.getType();
  reportTimingData['rtData'] = e.flow.timers();
  reportTimingData['cadData'] = e.flow.getExtraData();

  reportActionData = goog.object.clone(e.flow.getActionData());
  reportImpressionData = goog.object.clone(e.flow.getImpressionData());
}


var CONSTRUCTION_TIME = 314;
var TICK_TIME = 415;


function testActionFlow() {
  mockClock_.tick(CONSTRUCTION_TIME);

  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  var beforeReportTriggered = false;
  goog.events.listen(flow,
      jsaction.ActionFlow.EventType.BEFOREDONE, function() {
        assertFalse(reportSent);
        beforeReportTriggered = true;
      });

  mockClock_.tick(TICK_TIME);

  flow.tick('foo');
  assertEquals(1, timers.length);
  assertEquals('foo', timers[0][0]);
  assertEquals(TICK_TIME, timers[0][1]);
  assertEquals(TICK_TIME + CONSTRUCTION_TIME, flow.getTick('foo'));
  assertArrayEquals(['start', 'foo'], flow.getTickNames());

  flow.done(jsaction.Branch.MAIN);
  assertTrue(beforeReportTriggered);
  assertEquals('test', reportTimingData['flowType']);
  assertEquals(timers, reportTimingData['rtData']);
}


function testCadDataWithDataRecordedOnBeforeDone() {
  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  var beforeReportTriggered = false;
  goog.events.listen(
      flow, jsaction.ActionFlow.EventType.BEFOREDONE, function(e) {
        e.flow.addExtraData('extra', 'foo');
        beforeReportTriggered = true;
      });

  var actionData = null;
  goog.events.listen(
      jsaction.ActionFlow.report, jsaction.ActionFlow.EventType.DONE,
      function() {
        actionData = flow.getActionData();
      });


  flow.addExtraData('bar', 'baz');
  flow.done(jsaction.Branch.MAIN);

  assertTrue(beforeReportTriggered);
  assertNotNull(actionData);
  assertEquals('bar:baz,extra:foo', actionData['cad']);
}


function testOverrideStartTime() {
  mockClock_.tick(CONSTRUCTION_TIME);

  var START_TIME = 1;
  var flow = new jsaction.ActionFlow('test', null, null, START_TIME);
  var timers = flow.timers();

  mockClock_.tick(TICK_TIME);

  flow.tick('foo');
  assertEquals(1, timers.length);
  assertEquals('foo', timers[0][0]);
  assertEquals(TICK_TIME + CONSTRUCTION_TIME - START_TIME, timers[0][1]);
  assertEquals(TICK_TIME + CONSTRUCTION_TIME, flow.getTick('foo'));
  assertArrayEquals(['start', 'foo'], flow.getTickNames());
}


function testTickKeepsTimersSorted() {
  var START_TIME = 1;
  var flow = new jsaction.ActionFlow('test', null, null, START_TIME);
  var timers = flow.timers();

  flow.tick('foo', {time: 10});
  flow.tick('bar', {time: 5});
  flow.tick('baz', {time: 20});
  flow.tick('boo', {time: 3});
  assertEquals(2, timers[0][1]);
  assertArrayEquals(['start', 'boo', 'bar', 'foo', 'baz'],
                    flow.getTickNames());
  assertEquals(20, flow.getMaxTickTime());
}


function testTickNotInMaxTime() {
  var START_TIME = 1;
  var flow = new jsaction.ActionFlow('test', null, null, START_TIME);
  var timers = flow.timers();

  flow.tick('foo', {time: 10});
  flow.tick('bar', {time: 5});
  flow.tick('baz', {time: 20});
  flow.tick('superbaz', {time: 200, doNotIncludeInMaxTime: true});
  flow.tick('boo', {time: 3});
  assertEquals(2, timers[0][1]);
  assertArrayEquals(['start', 'boo', 'bar', 'foo', 'baz', 'superbaz'],
                    flow.getTickNames());
  assertEquals(20, flow.getMaxTickTime());
}


function testTickWithDoNotReportToServer() {
  var START_TIME = 1;
  var flow = new jsaction.ActionFlow('test', null, null, START_TIME);
  var timers = flow.timers();

  flow.tick('foo');
  flow.tick('bar', {doNotReportToServer: true});
  assertEquals('foo', timers[0][0]);
  assertEquals(undefined, timers[0][2]);
  assertEquals('bar', timers[1][0]);
  assertEquals(true, timers[1][2]);
}


function testTickWithDoNotReportToServerDoesNotAffectMaxTickTime() {
  var START_TIME = 1;
  var flow = new jsaction.ActionFlow('test', null, null, START_TIME);
  var timers = flow.timers();

  flow.tick('foo', {time: 10});
  flow.tick('bar', {time: 20, doNotReportToServer: true});
  assertEquals('foo', timers[0][0]);
  assertEquals(undefined, timers[0][2]);
  assertEquals('bar', timers[1][0]);
  assertEquals(true, timers[1][2]);
  assertEquals(10, flow.getMaxTickTime());
  assertNotNull(flow.getTick('foo'));
  assertNotNull(flow.getTick('bar'));
  assertEquals(20, flow.getTick('bar'));
}


function testNewBranchWithDoNotReportToServer() {
  var START_TIME = 1;
  var flow = new jsaction.ActionFlow('test', null, null, START_TIME);
  var timers = flow.timers();

  flow.tick('foo', {time: 10});
  flow.branch('branch1', 'bar0', {time: 20, doNotReportToServer: true});
  flow.done('branch1', 'bar1', {time: 30, doNotReportToServer: true});
  assertEquals(10, flow.getMaxTickTime());
  assertEquals('foo', timers[0][0]);
  assertEquals('bar0', timers[1][0]);
  assertEquals('bar1', timers[2][0]);
}


function testActionFlowAdoptDoesNothingOnNull() {
  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  flow.adopt(null);
  assertEquals(0, timers.length);
  assertArrayEquals(['start'], flow.getTickNames());
}


function testActionFlowAdoptDoesNothingWithoutStart() {
  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  flow.adopt({'foo': 10});
  assertEquals(0, timers.length);
  assertArrayEquals(['start'], flow.getTickNames());
}


function testActionFlowAdopt() {
  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  flow.adopt({'start': 1, 'foo': 10});
  assertEquals(1, timers.length);
  assertEquals('foo', timers[0][0]);
  assertEquals(9, timers[0][1]);
  assertEquals(10, flow.getTick('foo'));
  assertArrayEquals(['start', 'foo'], flow.getTickNames());
}


function testActionFlowAdoptAtStartZero() {
  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  flow.adopt({'start': 0, 'foo': 10});
  assertEquals(1, timers.length);
  assertEquals(10, flow.getTick('foo'));
  assertArrayEquals(['start', 'foo'], flow.getTickNames());
}


function testActionFlowAdoptDone() {
  var flow = new jsaction.ActionFlow('test');
  flow.adopt({'start': 1, 'foo': 10});
  flow.done(jsaction.Branch.MAIN);
  assertTrue('Adopt sends report with one done.', reportSent);
}


function testActionFlowAdoptDoneWithExpect() {
  var flow = new jsaction.ActionFlow('test');
  var mockBranches = {'branch1': 2};
  mockBranches[jsaction.Branch.MAIN] = 1;
  flow.adopt({'start': 1, 'foo': 10}, mockBranches);
  flow.done('branch1');
  assertFalse('Report incorrectly sent.', reportSent);
  flow.done(jsaction.Branch.MAIN);
  assertFalse('Report incorrectly sent.', reportSent);

  flow.done('branch1');
  assertTrue('Report not sent after the flow finished.', reportSent);
}


function testActionFlowMerge() {
  var flow = new jsaction.ActionFlow('test', null, null, 3);
  flow.tick('bar', {time: 20});
  var timers = flow.timers();

  jsaction.ActionFlow.merge(
      flow, {'start': 1, 'foo': 10, 'baz': 5, 'boo': 30});
  assertEquals(4, timers.length);
  assertEquals(2, timers[0][1]);
  assertEquals(7, timers[1][1]);
  assertEquals(10, flow.getTick('foo'));
  assertEquals(20, flow.getTick('bar'));
  assertArrayEquals(['start', 'baz', 'foo', 'bar', 'boo'],
                    flow.getTickNames());
}


function testReportSendCalledWithoutTicks() {
  var flow = new jsaction.ActionFlow('test');
  flow.done(jsaction.Branch.MAIN);
  assertTrue('ActionFlow reported without ticks.', reportSent);
}


function testTickWithoutDoneDoesNotSendReport() {
  var flow = new jsaction.ActionFlow('test');
  flow.tick('foo');
  assertFalse('Tick never sends report.', reportSent);
}


function testActionFlowWithWeirdFlowNames() {
  var flow = new jsaction.ActionFlow('t&s$tf#b~c');
  flow.tick('foo');
  flow.done(jsaction.Branch.MAIN);

  assertEquals('t_s$tf#b_c', reportTimingData['flowType']);
}


function testOneBranch() {
  var flow = new jsaction.ActionFlow('test');
  flow.tick('foo');

  flow.branch('branch1');
  assertFalse(reportSent);

  flow.done('branch1');
  assertFalse(reportSent);

  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);

  assertEquals(1, reportTimingData['rtData'].length);
}


function testMultipleBranches() {
  var flow = new jsaction.ActionFlow('test');
  flow.tick('foo');

  flow.branch('branch1');
  flow.branch('branch2');

  flow.done('branch1');
  assertFalse(reportSent);

  flow.done(jsaction.Branch.MAIN);
  assertFalse(reportSent);

  flow.done('branch2');
  assertTrue(reportSent);

  assertEquals(1, reportTimingData['rtData'].length);
}


function testTickDoneShortcut() {
  var flow = new jsaction.ActionFlow('test');
  flow.done(jsaction.Branch.MAIN, 'bar');
  assertTrue(reportSent);
  assertEquals(1, reportTimingData['rtData'].length);
}


function testTickBranchShortcut() {
  var flow = new jsaction.ActionFlow('test');

  flow.branch('foobranch', 'footick');
  flow.done('foobranch', 'bartick');
  assertFalse(reportSent);

  flow.done(jsaction.Branch.MAIN, 'baz');
  assertTrue(reportSent);
  assertEquals(3, reportTimingData['rtData'].length);
}


function testTrackedCallback() {
  var flow = new jsaction.ActionFlow('test');
  var callbackCalled = false;
  var fn = function() {
    callbackCalled = true;
  };

  var trackedCallback = flow.callback(fn, 'testbranch', 't0', 't1');

  assertTrue(goog.isDef(flow.getTick('t0')));

  jsaction.ActionFlow.done(flow, jsaction.Branch.MAIN);
  assertFalse(reportSent);

  trackedCallback();

  assertTrue(goog.isDef(flow.getTick('t1')));
  assertTrue(callbackCalled);
  assertTrue(reportSent);
}


function testIsOfType() {
  var flow = new jsaction.ActionFlow('foo');
  assertTrue(flow.isOfType('foo'));
  assertFalse(flow.isOfType('bar'));
}


function testIsOfTypeWithWeirdNames() {
  var flow = new jsaction.ActionFlow('t&est');
  assertTrue(flow.isOfType('t&est'));
  assertTrue(flow.isOfType('t_est'));
  assertFalse(flow.isOfType('bar'));
}

function testSetEventId() {
  var flow = new jsaction.ActionFlow('test');
  flow.maybeSetEventId('abcdefg');

  // No-op: already set.
  flow.maybeSetEventId('other-event-id');

  flow.done(jsaction.Branch.MAIN, 'done');

  assertTrue(reportSent);
  assertEquals('abcdefg', reportActionData['ei']);
}

function testAddActionDataWithTimers() {
  var flow = new jsaction.ActionFlow('test');
  flow.addExtraData('key1', 'value1');
  flow.addExtraData('key2', 'value2');
  flow.done(jsaction.Branch.MAIN, 'done');

  assertTrue(reportSent);
  assertEquals(reportTimingData['cadData']['key1'], 'value1');
  assertEquals(reportTimingData['cadData']['key2'], 'value2');
}


function testDuplicateTicks() {
  var flow = new jsaction.ActionFlow('test');
  flow.tick('tick');
  flow.tick('tick');
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('tick', reportTimingData['cadData']['dup']);
}


function testMultipleDuplicateTicks() {
  var flow = new jsaction.ActionFlow('test');
  flow.tick('tick1');
  flow.tick('tick1');
  flow.tick('tick2');
  flow.tick('tick2');
  flow.tick('tick1');
  flow.tick('tick3');
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('tick1|tick2', reportTimingData['cadData']['dup']);
}


function testAction() {
  var flow = new jsaction.ActionFlow('barAction');
  var target = document.getElementById('bar2');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('barAction', reportActionData['ct']);
  assertEquals(1, reportActionData['cd']);
  assertEquals('oi:maps.foo.bar', reportActionData['cad']);
  assertTrue(goog.object.isEmpty(reportImpressionData));
}


function testAction2() {
  var flow = new jsaction.ActionFlow('barAction');
  var target = document.getElementById('bar3');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('barAction', reportActionData['ct']);
  assertEquals(2, reportActionData['cd']);
  assertEquals('oi:maps.foo.bar', reportActionData['cad']);
  assertTrue(goog.object.isEmpty(reportImpressionData));
}


function testActionWithoutOiData() {
  var flow = new jsaction.ActionFlow('barAction');
  var target = document.getElementById('foo2');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('barAction', reportActionData['ct']);
}


function testActionAcrossIframes() {
  var flow = new jsaction.ActionFlow('barAction');
  var target = iframeDocument.getElementById('bar2');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('barAction', reportActionData['ct']);
  assertEquals(1, reportActionData['cd']);
  assertEquals('oi:maps.foo.bar', reportActionData['cad']);
  assertTrue(goog.object.isEmpty(reportImpressionData));
}


function testActionFromConstructor() {
  // When the constructor is passed a node and a click event, action() is
  // triggered from within the constructor.
  var target = document.getElementById('bar2');
  var clickEvent = jsaction.createEvent({type: 'click'});
  var flow = new jsaction.ActionFlow('barAction', target, clickEvent);
  flow.done(jsaction.Branch.MAIN);
  assertEquals('barAction', reportActionData['ct']);
  assertEquals(1, reportActionData['cd']);
  assertEquals('oi:maps.foo.bar', reportActionData['cad']);
  assertTrue(goog.object.isEmpty(reportImpressionData));
}


function testActionNestedEi() {
  var flow = new jsaction.ActionFlow('nestedAction');
  var target = document.getElementById('nested');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('eventid2', reportActionData['ei']);
  assertFalse('ved' in reportActionData);
}


function testActionWithNoTracking() {
  var flow = new jsaction.ActionFlow('fooAction');
  var target = document.getElementById('foo1');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertEquals(undefined, reportActionData['ct']);
  assertEquals(undefined, reportActionData['cd']);
  assertEquals(undefined, reportActionData['cad']);
  assertEquals(undefined, reportActionData['ei']);
  assertEquals(undefined, reportActionData['ved']);
}


function testActionWithNoOi() {
  var flow = new jsaction.ActionFlow('fooAction');
  var target = document.getElementById('foo2');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('fooAction', reportActionData['ct']);
  assertEquals(undefined, reportActionData['cd']);
  assertEquals(undefined, reportActionData['cad']);
  assertTrue(goog.object.isEmpty(reportImpressionData));
}


function testActionWithVed() {
  var flow = new jsaction.ActionFlow('bazAction');
  var target = document.getElementById('baz');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('bazAction', reportActionData['ct']);
  assertEquals(0, reportActionData['cd']);
  assertEquals('oi:maps2.baz2.baz3', reportActionData['cad']);
  assertEquals('baz1', reportActionData['ved']);
  assertEquals('eventid', reportActionData['ei']);
}


function testActionWithVet() {
  var flow = new jsaction.ActionFlow('nestedAction');
  var target = document.getElementById('nested');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('nestedAction', reportActionData['ct']);
  assertEquals('vet2', reportActionData['vet']);
}


function testActionWithVetNoJstrack() {
  var flow = new jsaction.ActionFlow('fooAction');
  var target = document.getElementById('foo1');
  flow.action(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('vet1', reportActionData['vet']);
}


function testAddActionData() {
  var flow = new jsaction.ActionFlow('barAction');
  var target = document.getElementById('bar2');
  flow.action(target);
  flow.addExtraData('key1', 'value1');
  assertEquals('value1', flow.getExtraData()['key1']);
  flow.addExtraData('key2', 'value2');
  assertEquals('value2', flow.getExtraData()['key2']);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertEquals('oi:maps.foo.bar,key1:value1,key2:value2',
               reportActionData['cad']);
}


function testImpressionWithTwoChildrenBothDisplayed() {
  var flow = new jsaction.ActionFlow('test');
  var target = document.getElementById('foo');
  var bar = document.getElementById('bar1');
  bar.style['display'] = '';
  flow.impression(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertTrue(goog.object.isEmpty(reportActionData));
  assertEquals(1, reportImpressionData['maps.foo']);
  assertEquals(3, reportImpressionData['maps.foo.bar']);
}


function testImpressionWithOneChildDisplayedAndOneChildHidden() {
  var flow = new jsaction.ActionFlow('test');
  var target = document.getElementById('foo');
  var bar = document.getElementById('bar1');
  bar.style['display'] = 'none';
  flow.impression(target);
  flow.done(jsaction.Branch.MAIN);
  assertTrue(reportSent);
  assertTrue(goog.object.isEmpty(reportActionData));
  assertEquals(1, reportImpressionData['maps.foo']);
  assertEquals(2, reportImpressionData['maps.foo.bar']);
}


function testStaticTickBranchDone() {
  var undefinedFlow = undefined;
  jsaction.ActionFlow.tick(undefinedFlow, 'foo');
  jsaction.ActionFlow.branch(undefinedFlow, 'branchfoo');
  jsaction.ActionFlow.done(undefinedFlow, 'branchfoo');

  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  jsaction.ActionFlow.tick(flow, 'tick', 0);
  assertEquals(0, flow.getTick('tick'));

  jsaction.ActionFlow.branch(flow, 'testbranch', 'branchtick');
  assertTrue(goog.isDef(flow.getTick('tick')));

  flow.done('testbranch');
  assertFalse(reportSent);

  jsaction.ActionFlow.done(flow, jsaction.Branch.MAIN, 'done');
  assertEquals('start_tick_branchtick_done', flow.getTickNames().join('_'));
  assertTrue(reportSent);
}


function testAbandonActionFlow() {
  mockClock_.tick(CONSTRUCTION_TIME);

  var flow = new jsaction.ActionFlow('test');
  var timers = flow.timers();

  var beforeReportTriggered = false;
  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.BEFOREDONE, function() {
        assertFalse(reportSent);
        beforeReportTriggered = true;
      });

  mockClock_.tick(TICK_TIME);

  flow.tick('foo');
  assertEquals(1, timers.length);
  assertEquals('foo', timers[0][0]);
  flow.abandon();

  flow.done(jsaction.Branch.MAIN);
  assertFalse(beforeReportTriggered);
  assertFalse(reportSent);
  assertUndefined(reportTimingData['flowType']);
  assertUndefined(reportTimingData['rtData']);
  assertUndefined(reportTimingData['cadData']);
}


function testGetType() {
  var flow = new jsaction.ActionFlow('test');
  assertEquals('test', flow.getType());
}


function testSetType() {
  var flow = new jsaction.ActionFlow('foo');
  assertEquals('foo', flow.getType());
  assertEquals('foo', flow.flowType());
  flow.setType('bar');
  assertEquals('bar', flow.getType());
  assertEquals('bar', flow.flowType());
}


function testErrorReportTriggeredOnBranchAfterFlowFinished() {
  var flow = new jsaction.ActionFlow('test');
  var errorEvent = null;

  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.ERROR, function(e) {
        errorEvent = e;
      });

  flow.tick('foo');
  flow.addExtraData('key1', 'value1');

  flow.done(jsaction.Branch.MAIN);
  assertNull(errorEvent);

  flow.branch('wrongbranch');
  assertNotNull(errorEvent);

  assertEquals(jsaction.ActionFlow.Error.BRANCH, errorEvent.error);
  assertEquals('wrongbranch', errorEvent.branch);
  assertEquals('test', errorEvent.flow.flowType());
  assertTrue(errorEvent.finished);
  assertEquals(reportTimingData['rtData'], errorEvent.flow.timers());
  assertEquals(reportTimingData['cadData'], errorEvent.flow.getExtraData());
}


function testErrorReportTriggeredOnDoneAfterFlowFinished() {
  var flow = new jsaction.ActionFlow('test');
  var errorEvent = null;

  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.ERROR, function(e) {
        errorEvent = e;
      });

  flow.tick('foo');
  flow.addExtraData('key1', 'value1');

  flow.done(jsaction.Branch.MAIN);
  assertNull(errorEvent);

  flow.done('wrongbranch', 'badtick');
  assertNotNull(errorEvent);

  assertEquals(jsaction.ActionFlow.Error.DONE, errorEvent.error);
  assertEquals('wrongbranch', errorEvent.branch);
  assertTrue(errorEvent.finished);
  assertEquals('badtick', errorEvent.tick);
  assertEquals('test', errorEvent.flow.flowType());
  assertEquals(reportTimingData['rtData'], errorEvent.flow.timers());
  assertEquals(reportTimingData['cadData'], errorEvent.flow.getExtraData());
}


function testErrorReportTriggeredOnTickAfterFlowFinished() {
  var flow = new jsaction.ActionFlow('errortest');
  var errorEvent = null;

  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.ERROR, function(e) {
        errorEvent = e;
      });

  flow.done(jsaction.Branch.MAIN);
  assertNull(errorEvent);

  flow.tick('badtick');
  assertNotNull(errorEvent);

  assertEquals(jsaction.ActionFlow.Error.TICK, errorEvent.error);
  assertUndefined(errorEvent.branch);
  assertEquals('badtick', errorEvent.tick);
  assertTrue(errorEvent.finished);
  assertEquals('errortest', errorEvent.flow.flowType());
  assertEquals(reportTimingData['rtData'], errorEvent.flow.timers());
  assertEquals(reportTimingData['cadData'], errorEvent.flow.getExtraData());
  assertTrue(goog.object.isEmpty(errorEvent.flow.branches()));
}


function testErrorReportTriggeredOnAddExtraDataAfterFlowFinished() {
  var flow = new jsaction.ActionFlow('errortest');
  var errorEvent = null;

  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.ERROR, function(e) {
        errorEvent = e;
      });

  flow.done(jsaction.Branch.MAIN);
  assertNull(errorEvent);

  flow.addExtraData('badkey', 'bad value');
  assertNotNull(errorEvent);

  assertEquals(jsaction.ActionFlow.Error.EXTRA_DATA, errorEvent.error);
  assertUndefined(errorEvent.branch);
  assertUndefined(errorEvent.tick);
  assertTrue(errorEvent.finished);
  assertEquals('errortest', errorEvent.flow.flowType());
  assertTrue(goog.object.isEmpty(errorEvent.flow.branches()));
}


function testErrorReportTriggeredOnActionAfterFlowFinished() {
  var target = document.getElementById('bar2');
  var flow = new jsaction.ActionFlow('errortest');
  var errorEvent = null;

  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.ERROR, function(e) {
        if (!errorEvent) {
          errorEvent = e;
        }
      });

  flow.done(jsaction.Branch.MAIN);
  assertNull(errorEvent);

  flow.action(target);
  assertNotNull(errorEvent);

  assertEquals(jsaction.ActionFlow.Error.ACTION, errorEvent.error);
  assertUndefined(errorEvent.branch);
  assertUndefined(errorEvent.tick);
  assertTrue(errorEvent.finished);
  assertEquals('errortest', errorEvent.flow.flowType());
  assertTrue(goog.object.isEmpty(errorEvent.flow.branches()));
}


function testErrorReportTriggeredOnImpressionAfterFlowFinished() {
  var target = document.getElementById('bar2');
  var flow = new jsaction.ActionFlow('errortest');
  var errorEvent = null;

  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.ERROR, function(e) {
        if (!errorEvent) {
          errorEvent = e;
        }
      });

  flow.done(jsaction.Branch.MAIN);
  assertNull(errorEvent);

  flow.impression(target);
  assertNotNull(errorEvent);

  assertEquals(jsaction.ActionFlow.Error.IMPRESSION, errorEvent.error);
  assertUndefined(errorEvent.branch);
  assertUndefined(errorEvent.tick);
  assertTrue(errorEvent.finished);
  assertEquals('errortest', errorEvent.flow.flowType());
  assertTrue(goog.object.isEmpty(errorEvent.flow.branches()));
}


function testErrorReportTriggeredOnDoneOnABranchNotPending() {
  var flow = new jsaction.ActionFlow('errortest');
  var errorEvent = null;

  goog.events.listen(jsaction.ActionFlow.report,
      jsaction.ActionFlow.EventType.ERROR, function(e) {
        errorEvent = e;
      });

  flow.branch('branch1');
  // branch2 was never opened.
  flow.done('branch2');
  flow.done(jsaction.Branch.MAIN);

  assertNotNull(errorEvent);

  assertEquals(jsaction.ActionFlow.Error.DONE, errorEvent.error);
  assertEquals('branch2', errorEvent.branch);
  assertUndefined(errorEvent.tick);
  assertFalse(errorEvent.finished);
  assertEquals('errortest', errorEvent.flow.flowType());
  assertEquals(1, errorEvent.flow.branches()['branch1']);
}


function testJsActionFlow_Type_Node_Event_Values() {
  var node = document.createElement('div');
  node.foo = 1;
  var event = jsaction.createEvent({type: 'click'});
  var flowType = 'bar';
  var flow = new jsaction.ActionFlow(flowType, node, event);

  assertEquals(flowType, flow.flowType());
  assertEquals(1, flow.value('foo'));
  assertEquals(node, flow.node());
}


function testGetEventNodeNull() {
  var flow = new jsaction.ActionFlow('baz', null, null);
  assertNull(flow.event());
  assertNull(flow.node());
}


function testDoneClearsNodeAndEvent() {
  var node = document.createElement('div');
  var event = jsaction.createEvent({type: 'click'});
  var flow = new jsaction.ActionFlow('baz', node, event);

  assertNotNull(flow.node());
  assertNotNull(flow.event());

  flow.done(jsaction.Branch.MAIN);

  assertNull(flow.node());
  assertNull(flow.event());
}


function testDoneClearsNodeAndEvent_MultipleBranches() {
  var node = document.createElement('div');
  var event = jsaction.createEvent({type: 'click'});
  var flow = new jsaction.ActionFlow('test', node, event);

  assertNotNull(flow.node());
  assertNotNull(flow.event());

  flow.branch('b1');
  flow.branch('b2');

  flow.done('b1');

  assertNotNull(flow.node());
  assertNotNull(flow.event());

  flow.done('b2');

  assertNotNull(flow.node_);
  assertNotNull(flow.event_);

  flow.done(jsaction.Branch.MAIN);

  assertNull(flow.node());
  assertNull(flow.event());
}


function testJsActionFlowCopiesEventObjectOnIEBefore9() {
  // This is restored on tearDown so that it doesn't affect other tests if this
  // one fails.
  savedGlobal_ = goog.global;
  // The event gets copied if there is no document.createEvent and we have
  // document.createEventObject (see jsaction.event.maybeCopyEvent).
  var mockDocument = {};
  mockDocument.createEventObject = function() {
    var retval = {};
    for (var i in event) {
      retval[i] = event[i];
    }
    return retval;
  };
  goog.global = {};
  goog.global['document'] = mockDocument;
  var node = {};
  var event = {'type': '', 'foo': {}};
  var flow = new jsaction.ActionFlow('foo', node, event);

  // The event should be deep copied.
  assertNotEquals(event, flow.event());
  assertEquals(event['foo'], flow.event()['foo']);
}


function testGetNamespace() {
  var node = document.createElement('div');
  var event = jsaction.createEvent({type: 'click'});

  var flowWithNamespace = new jsaction.ActionFlow('gna.fu', node, event);
  assertEquals('gna', flowWithNamespace.actionNamespace());

  var flowWithoutNamespace = new jsaction.ActionFlow('fu', node, event);
  assertEquals('', flowWithoutNamespace.actionNamespace());
}


function testInstanceRegistry() {
  var flow = new jsaction.ActionFlow('foo');
  assertTrue(goog.array.contains(jsaction.ActionFlow.instances, flow));

  flow.done(jsaction.Branch.MAIN);
  assertFalse(goog.array.contains(jsaction.ActionFlow.instances, flow));
}
