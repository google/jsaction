/**
 * @fileoverview Tests for jsaction.js.
 */

/** @suppress {extraProvide} */
goog.provide('jsaction.jsactionTest');
goog.setTestOnly('jsaction.jsactionTest');

goog.require('goog.testing.jsunit');
goog.require('goog.userAgent');
goog.require('jsaction');


function testCreateCustomEvent() {
  if (goog.userAgent.IE && !goog.userAgent.isVersionOrHigher('9')) {
    // This test case fails on ie8-winxp with "Object doesn't support this
    // property or method".
    return;
  }
  var triggeringEvent = document.createElement('div');
  var event = jsaction.createCustomEvent(
      'eventType', { data1: 'dataContent' }, triggeringEvent);
  assertNotNull(event);
  assertNotNull(event.detail);
  var detail = event.detail;
  assertEquals('eventType', detail['_type']);
  assertNotNull(detail.data);
  assertEquals('dataContent', detail.data.data1);
  assertEquals(triggeringEvent, detail.triggeringEvent);
}
