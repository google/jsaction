goog.provide('jsaction.testing.CustomEvents');
goog.setTestOnly('jsaction.testing.CustomEvents');

goog.require('goog.Disposable');
goog.require('jsaction.ActionFlow');
goog.require('jsaction.EventType');


/**
 * Testing context for listening to jsaction custom events. This class should be
 * instantiated in a test's setUp. All listeners created in this context are
 * removed in CustomEvents#dispose, which should be called from the test's
 * tearDown.
 * @suppress {checkStructDictInheritance}
 */
jsaction.testing.CustomEvents = goog.defineClass(goog.Disposable, {
  statics: {
    DEFAULT_FLOWTYPE: 'jsaction.test'
  },


  constructor: function() {
    jsaction.testing.CustomEvents.base(this, 'constructor');
    this.managedListeners_ = [];
  },


  /**
   * Adds a listener for a jsaction custom event.
   * @param {!Element} element The element on which to listen.
   * @param {string} eventType The custom event type.
   * @param {function(this:T, !jsaction.ActionFlow)} listener A listener
   *     callback.
   * @param {!T=} opt_context The context in which to call the callback.
   * @param {string=} opt_flowType The ActionFlow type given to the listener.
   * @template T
   */
  listen: function(element, eventType, listener, opt_context, opt_flowType) {
    var jsactionListener = function(event) {
      if (event.detail['_type'] == eventType) {
        var actionFlow = new jsaction.ActionFlow(
            opt_flowType || jsaction.testing.CustomEvents.DEFAULT_FLOWTYPE,
            element, event, undefined /* startTime */, eventType);
        listener.call(opt_context, actionFlow);
      }
    };

    element.addEventListener(jsaction.EventType.CUSTOM, jsactionListener);
    this.managedListeners_.push(
        {'element': element, 'listener': jsactionListener});
  },


  /**
   * Removes all listeners.
   */
  disposeInternal: function() {
    for (var i = 0; i < this.managedListeners_.length; i++) {
      var listenerInfo = this.managedListeners_[i];
      listenerInfo['element'].removeEventListener(
          jsaction.EventType.CUSTOM, listenerInfo['listener']);
    }
    this.managedListeners_ = [];
  }
});
