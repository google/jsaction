goog.provide('jsaction.jsactionTest');
goog.setTestOnly('jsaction.jsactionTest');

goog.require('goog.events.EventType');
goog.require('goog.testing.jsunit');
goog.require('jsaction');

var eventsToTargets = {};
jsaction.fireCustomEvent = function(target, type, opt_data) {
  if (eventsToTargets[type]) {
    eventsToTargets[type].push(target);
  } else {
    eventsToTargets[type] = [target];
  }
};

// Fix Object.keys for IE8
if (!Object.keys) {
  Object.keys = function(obj) {
    var keys = [];

    for (var i in obj) {
      if (obj.hasOwnProperty(i)) {
        keys.push(i);
      }
    }

    return keys;
  };
}

function setUp() {
  eventsToTargets = {};
}

function tearDown() {
  eventsToTargets = {};
}

function testFireCustomEventDownNoMatches() {
  jsaction.broadcastCustomEvent(document.getElementById('no-matches'),
                                'customEvent');
  assertEquals(0, Object.keys(eventsToTargets).length);
}

function testFireCustomEventDownMatches() {
  jsaction.broadcastCustomEvent(document.getElementById('matches'),
                                'customEvent');
  assertEquals(1, Object.keys(eventsToTargets).length);
  assertTrue('customEvent' in eventsToTargets);
  jsaction.broadcastCustomEvent(document.getElementById('matches'),
                                'custom2');
  assertEquals(2, Object.keys(eventsToTargets).length);
  assertTrue('custom2' in eventsToTargets);
  assertEquals(2, eventsToTargets['customEvent'].length);
  assertEquals('matches-foo', eventsToTargets['customEvent'][0].id);
  assertEquals('matches-bar', eventsToTargets['customEvent'][1].id);

  assertEquals(1, eventsToTargets['custom2'].length);
  assertEquals('matches2', eventsToTargets['custom2'][0].id);
}

function testFireCustomEventDownNestedMatches() {
  jsaction.broadcastCustomEvent(document.getElementById('nested'),
                                'customEvent');
  assertEquals(1, Object.keys(eventsToTargets).length);
  assertTrue('customEvent' in eventsToTargets);
  jsaction.broadcastCustomEvent(document.getElementById('nested'),
                                'custom2');
  assertEquals(2, Object.keys(eventsToTargets).length);
  assertTrue('custom2' in eventsToTargets);

  assertEquals(3, eventsToTargets['customEvent'].length);
  assertEquals('nested-foo', eventsToTargets['customEvent'][0].id);
  assertEquals('nested-bar', eventsToTargets['customEvent'][1].id);
  assertEquals('nested-qux', eventsToTargets['customEvent'][2].id);

  assertEquals(1, eventsToTargets['custom2'].length);
  assertEquals('nested2', eventsToTargets['custom2'][0].id);
}
