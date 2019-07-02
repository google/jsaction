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
 */
jsaction.testing.CustomEvents = class extends goog.Disposable {
  constructor() {
    super();
    this.managedListeners_ = [];
  }

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
  listen(element, eventType, listener, opt_context, opt_flowType) {
    const jsactionListener = function(event) {
      if (event.detail['_type'] == eventType) {
        const actionFlow = new jsaction.ActionFlow(
            opt_flowType || jsaction.testing.CustomEvents.DEFAULT_FLOWTYPE,
            element, event, undefined /* startTime */, eventType);
        listener.call(opt_context, actionFlow);
      }
    };

    element.addEventListener(jsaction.EventType.CUSTOM, jsactionListener);
    this.managedListeners_.push(
        {'element': element, 'listener': jsactionListener});
  }

  /**
   * Removes all listeners.
   */
  disposeInternal() {
    for (let idx = 0; idx < this.managedListeners_.length; idx++) {
      const listenerInfo = this.managedListeners_[idx];
      listenerInfo['element'].removeEventListener(
          jsaction.EventType.CUSTOM, listenerInfo['listener']);
    }
    this.managedListeners_ = [];
  }
};

jsaction.testing.CustomEvents.DEFAULT_FLOWTYPE = 'jsaction.test';
