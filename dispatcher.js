// Copyright 2005 Google Inc. All Rights Reserved.


goog.provide('jsaction.Dispatcher');

goog.require('goog.array');
goog.require('goog.async.run');
goog.require('goog.dom.TagName');
goog.require('goog.functions');
goog.require('goog.object');
goog.require('jsaction.A11y');
goog.require('jsaction.ActionFlow');
goog.require('jsaction.Branch');
goog.require('jsaction.Char');
goog.require('jsaction.EventType');
goog.require('jsaction.event');
goog.require('jsaction.replayEvent');
goog.requireType('jsaction.Loader');



/**
 * An action for a namespace. It consists of two members:
 *   accept -- whether the handler can accept the given
 *       EventInfo immediately. If it returns false, the
 *       dispatcher will queue the events for later replaying, which
 *       can be triggered by calling replay().
 *   handle -- the actual handler for the namespace.
 * @typedef {{accept: function(jsaction.EventInfo): boolean,
 *            handle: function(jsaction.ActionFlow)}}
 */
jsaction.NamespaceAction;


/**
 * Receives a DOM event, determines the jsaction associated with the source
 * element of the DOM event, and invokes the handler associated with the
 * jsaction.
 *
 * @param {function(jsaction.EventInfo):jsaction.ActionFlow=} opt_flowFactory
 *     A function that knows how to instantiate an ActionFlow for a particular
 *     browser event. If not provided, a built-in one is used.
 * @param {function(jsaction.EventInfo):Function=} opt_getHandler A function
 *     that knows how to get the handler for a given event info.
 * @param {boolean=} opt_isWiz Whether this dispatcher dispatches wiz events.
 * @constructor
 */
jsaction.Dispatcher = function(opt_flowFactory, opt_getHandler, opt_isWiz) {
  /**
   * The actions that are registered for this jsaction.Dispatcher instance.
   *
   * @type {Object}
   * @private
   */
  this.actions_ = {};

  /**
   * A map from namespace to associated actions.
   * @type {!Object.<!jsaction.NamespaceAction>}
   * @private
   */
  this.namespaceActions_ = {};

  /**
   * A mapping between namespaces and loader functions.  We also keep a flag
   * indicating whether the loader was called to prevent it being called
   * multiple times.
   * @type {!Object.<string,{loader: jsaction.Loader, called: boolean}>}
   * @private
   */
  this.loaders_ = {};

  /**
   * The default loader to be invoked if no loader is found for a particular
   * namespace.
   * @type {?jsaction.Loader}
   * @private
   */
  this.defaultLoader_ = null;

  /**
   * A list of namespaces already loaded by the default loader.  This avoids
   * loading them once again.  Using Object (with namespaces as keys) instead of
   * Array for O(1) search.
   * @type {!Object.<boolean>}
   * @private
   */
  this.defaultLoaderNamespaces_ = {};

  /**
   * The queue of events.
   * @type {!Array.<jsaction.EventInfo>}
   * @private
   */
  this.queue_ = [];

  const factory = opt_flowFactory || jsaction.Dispatcher.createActionFlow_;
  /**
   * The ActionFlow factory.
   * @type {function(jsaction.EventInfo):jsaction.ActionFlow}
   * @private
   */
  this.flowFactory_ = function(eventInfo) {
    const actionFlow = factory(eventInfo);
    if (actionFlow && opt_isWiz) {
      actionFlow.setWiz();
    }
    return actionFlow;
  };


  /**
   * A function to retrieve the handler function for a given event info.
   * @type {function(jsaction.EventInfo):Function|undefined}
   * @private
   */
  this.getHandler_ = opt_getHandler;

  /**
   * A map of global event handlers, where each key is an event type.
   * @private {!Object.<string, !Array.<function(!Event):(boolean|undefined)>>}
   */
  this.globalHandlers_ = {};

  /**
   * @private {?function(
   *     !Array.<?jsaction.EventInfo>, !jsaction.Dispatcher):void}
   */
  this.eventReplayer_ = null;
};


/**
 * Receives an event or the event queue from the EventContract. The event
 * queue is copied and it attempts to replay.
 * If event info is passed in it looks for an action handler that can handle
 * the given event.  If there is no handler registered queues the event and
 * checks if a loader is registered for the given namespace. If so, calls it.
 *
 * Alternatively, if in global dispatch mode, calls all registered global
 * handlers for the appropriate event type.
 *
 * The three functionalities of this call are deliberately not split into three
 * methods (and then declared as an abstract interface), because the interface
 * is used by EventContract, which lives in a different jsbinary. Therefore the
 * interface between the three is defined entirely in terms that are invariant
 * under jscompiler processing (Function and Array, as opposed to a custom type
 * with method names).
 *
 * @param {(!jsaction.EventInfo|!Array<!jsaction.EventInfo>)} eventInfo
 *    The info for the event that triggered this call or the queue of events
 *    from EventContract.
 * @param {boolean=} isGlobalDispatch If true, dispatches a global event
 *    instead of a regular jsaction handler.
 * @return {!Event|undefined} Returns an event for the event contract to handle
 *     again IFF we tried to resolve an a11y event that can't be casted to a
 *     click.
 */
jsaction.Dispatcher.prototype.dispatch = function(eventInfo, isGlobalDispatch) {
  if (goog.isArrayLike(eventInfo)) {
    // We received the queued events from EventContract. Copy them and try to
    // replay.
    this.queue_ = this.cloneEventInfoQueue(
        /** @type {!Array<jsaction.EventInfo>} */ (eventInfo));
    this.replayQueuedEvents_();
    return;
  }

  const resolvedA11yEvent = this.maybeResolveA11yEvent(
      /** @type {jsaction.EventInfo} */ (eventInfo), isGlobalDispatch);
  if (resolvedA11yEvent['needsRetrigger']) {
    return resolvedA11yEvent['event'];
  }
  eventInfo = resolvedA11yEvent;

  if (isGlobalDispatch) {
    // Skip everything related to jsaction handlers, and execute the global
    // handlers.
    const ev = eventInfo['event'];
    const eventTypeHandlers = this.globalHandlers_[eventInfo['eventType']];
    let shouldPreventDefault = false;
    if (eventTypeHandlers) {
      for (let idx = 0, handler; handler = eventTypeHandlers[idx++];) {
        if (handler(ev) === false) {
          shouldPreventDefault = true;
        }
      }
    }
    if (shouldPreventDefault) {
      jsaction.event.preventDefault(ev);
    }
    return;
  }

  const action = eventInfo['action'];
  const namespace = jsaction.Dispatcher.getNamespace_(action);
  const namespaceAction = this.namespaceActions_[namespace];

  let handler;
  if (this.getHandler_) {
    handler = this.getHandler_(eventInfo);
  } else if (!namespaceAction) {
    handler = this.actions_[action];
  } else if (namespaceAction.accept(eventInfo)) {
    handler = namespaceAction.handle;
  }

  if (handler) {
    const stats = this.flowFactory_(
        /** @type {!jsaction.EventInfo} */ (eventInfo));
    handler(stats);
    stats.done(jsaction.Branch.MAIN);
    return;
  }

  // No handler was found. Potentially make a copy of the event to extend its
  // life and queue it.
  const eventCopy = jsaction.event.maybeCopyEvent(eventInfo['event']);
  eventInfo['event'] = eventCopy;
  this.queue_.push(eventInfo);

  if (!namespaceAction) {
    // If there is no handler, check if there is a loader available.
    // If there already is a handler for the namespace, but it is not
    // yet ready to accept the event, then the namespace handler
    // might load handlers on its own, and will call replay() later.
    this.maybeInvokeLoader_(namespace, eventInfo);
  }
};


/**
 * Makes a shallow copy of the EventInfo queue, where any MAYBE_CLICK_EVENT_TYPE
 * typed events get their type converted to CLICK or KEYDOWN.
 * Because clients of jsaction must provide their own implementation of how to
 * replay queued events, this removes the need for those clients to know how to
 * handle MAYBE_CLICK_EVENT_TYPE events.
 *
 * @param {!Array<!jsaction.EventInfo>} eventInfoQueue
 * @return {!Array<!jsaction.EventInfo>}
 */
jsaction.Dispatcher.prototype.cloneEventInfoQueue = function(eventInfoQueue) {
  const resolvedEventInfoQueue = [];
  for (let i = 0; i < eventInfoQueue.length; i++) {
    const resolvedEventInfo = this.maybeResolveA11yEvent(eventInfoQueue[i]);
    if (resolvedEventInfo['needsRetrigger']) {
      // Normally the event contract will check for the needsRetrigger value
      // after a dispatch, but in the case of replaying a queue, the replay
      // function decides how to handle each eventInfo without going through the
      // event contract. Since these events need to have the appropriate action
      // for them found, we will replay them so that they can be caught and
      // handled by the contract.
      jsaction.replayEvent(resolvedEventInfo);
    } else {
      resolvedEventInfoQueue.push(resolvedEventInfo);
    }
  }

  return resolvedEventInfoQueue;
};

/**
 * If a 'MAYBE_CLICK_EVENT_TYPE' event was dispatched, updates the eventType to
 * either click or keydown based on whether the keydown action can be treated as
 * a click. For MAYBE_CLICK_EVENT_TYPE events that are just keydowns, we set
 * flags on the event object so that the event contract does't try to dispatch
 * it as a MAYBE_CLICK_EVENT_TYPE again.
 *
 * @param {!jsaction.EventInfo} eventInfo
 * @param {boolean=} isGlobalDispatch Whether the eventInfo is meant to be
 *     dispatched to the global handlers.
 * @return {!jsaction.EventInfo} Returns a jsaction.EventInfo object with the
 *     MAYBE_CLICK_EVENT_TYPE converted to CLICK or KEYDOWN.
 */
jsaction.Dispatcher.prototype.maybeResolveA11yEvent = function(
    eventInfo, isGlobalDispatch = false) {
  if (eventInfo['eventType'] !== jsaction.A11y.MAYBE_CLICK_EVENT_TYPE) {
    return eventInfo;
  }

  const /** !jsaction.EventInfo */ eventInfoCopy =
      /** @type {!jsaction.EventInfo} */ (goog.object.clone(eventInfo));
  const event = eventInfoCopy['event'];

  if (this.isA11yClickEvent_(eventInfo, isGlobalDispatch)) {
    if (this.shouldPreventDefault_(eventInfoCopy)) {
      jsaction.event.preventDefault(event);
    }
    // If the keydown event can be treated as a click, we change the eventType
    // to 'click' so that the dispatcher can retrieve the right handler for it.
    // Even though EventInfo['action'] corresponds to the click action, the
    // global handler and any custom 'getHandler' implementations may rely on
    // the eventType instead.
    eventInfoCopy['eventType'] = jsaction.EventType.CLICK;
  } else {
    // Otherwise, if the keydown can't be treated as a click, we need to
    // retrigger it because now we need to look for 'keydown' actions instead.
    eventInfoCopy['eventType'] = jsaction.EventType.KEYDOWN;
    if (!isGlobalDispatch) {
      const eventCopy = jsaction.event.maybeCopyEvent(event);
      // This prevents the event contract from setting the
      // jsaction.A11y.MAYBE_CLICK_EVENT_TYPE type for Keydown events.
      eventCopy[jsaction.A11y.SKIP_A11Y_CHECK] = true;
      // Since globally dispatched events will get handled by the dispatcher,
      // don't have the event contract dispatch it again.
      eventCopy[jsaction.A11y.SKIP_GLOBAL_DISPATCH] = true;
      eventInfoCopy['event'] = eventCopy;
      // Cancels the dispatch early and tells the dispatcher to send this event
      // back to the event contract.
      eventInfoCopy['needsRetrigger'] = true;
    }
  }
  return eventInfoCopy;
};

/**
 * Returns true if the given key event can be treated as a 'click'.
 *
 * @param {!jsaction.EventInfo} eventInfo
 * @param {boolean=} isGlobalDispatch Whether the eventInfo is meant to be
 *     dispatched to the global handlers.
 * @return {boolean}
 * @private
 */
jsaction.Dispatcher.prototype.isA11yClickEvent_ = function(
    eventInfo, isGlobalDispatch) {
  return (isGlobalDispatch || eventInfo['actionElement']) &&
      jsaction.event.isActionKeyEvent(eventInfo['event']);
};

/**
 * Returns true if the default action for this event should be prevented
 * before the event handler is envoked.
 *
 * @param {!jsaction.EventInfo} eventInfo
 * @return {boolean}
 * @private
 */
jsaction.Dispatcher.prototype.shouldPreventDefault_ = function(eventInfo) {
  // For parity with no-a11y-support behavior.
  if (!eventInfo['actionElement']) {
    return false;
  }
  const event = eventInfo['event'];
  // Prevent scrolling if the Space key was pressed
  if (jsaction.event.isSpaceKeyEvent(event)) {
    return true;
  }
  // or prevent the browser's default action for native HTML controls.
  if (jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl(event)) {
    return true;
  }
  // Prevent browser from following <a> node links if a jsaction is present
  // and we are dispatching the action now. Note that the targetElement may be a
  // child of an anchor that has a jsaction attached. For that reason, we need
  // to check the actionElement rather than the targetElement.
  if (eventInfo['actionElement'].tagName == goog.dom.TagName.A) {
    return true;
  }
  return false;
};



/**
 * Registers a loader function to be called in case a jsaction is
 * encountered for which there is no handler registered. The loader is
 * expected to register the jsaction handlers for the given namespace.
 *
 * @param {string} actionNamespace The action namespace.
 * @param {jsaction.Loader} loaderFn The loader that will install the action
 *     handlers for this namespace. It takes the dispatcher and the namespace as
 *     parameters.
 */
jsaction.Dispatcher.prototype.registerLoader = function(
    actionNamespace, loaderFn) {
  this.loaders_[actionNamespace] = {loader: loaderFn, called: false};
};


/**
 * Registers the default loader function to be called if no specific loader
 * exists for a given namespace.
 *
 * @param {jsaction.Loader} loaderFn The loader that will install the action
 *     handlers for this namespace. It takes the dispatcher and the namespace
 *     as parameters.
 */
jsaction.Dispatcher.prototype.registerDefaultLoader = function(loaderFn) {
  this.defaultLoader_ = loaderFn;
};


/**
 * Registers a handler for a whole namespace. The dispatcher will
 * dispatch all jsaction for the given namespace to the handler.
 *
 * Namespace handlers has higher precedence than other handlers/loader.
 *
 * @param {string} namespace The namespace to register handler on.
 * @param {function(jsaction.ActionFlow)} handler The handler function.
 * @param {(function(jsaction.EventInfo):boolean)=} opt_accept
 *     A function that, given the EventInfo, can determine whether
 *     the event should be immediately handled or be queued. Defaults
 *     to always returning true.
 */
jsaction.Dispatcher.prototype.registerNamespaceHandler = function(
    namespace, handler, opt_accept) {
  this.namespaceActions_[namespace] = {
    accept: opt_accept || goog.functions.TRUE,
    handle: handler
  };
};


/**
 * Invokes the loader for the namespace if there is one and it wasn't called
 * already.  The dispatcher is passed as a parameter to the loader.  If no
 * loader is found for the namespace, invoke the default loader.
 *
 * @param {string} namespace The namespace.
 * @param {jsaction.EventInfo} eventInfo The event info.
 * @private
 */
jsaction.Dispatcher.prototype.maybeInvokeLoader_ = function(
    namespace, eventInfo) {
  const loaderInfo = this.loaders_[namespace];
  if (!loaderInfo) {
    if (this.defaultLoader_ && !(namespace in this.defaultLoaderNamespaces_)) {
      this.defaultLoaderNamespaces_[namespace] = true;
      this.defaultLoader_(this, namespace, eventInfo);
    }
  } else if (!loaderInfo.called) {
    loaderInfo.loader(this, namespace, eventInfo);
    loaderInfo.called = true;
  }
};


/**
 * Extracts and returns the namespace from a fully qualified jsaction
 * of the form "namespace.actionname".
 * @param {string} action The action.
 * @return {string} The namespace.
 * @private
 */
jsaction.Dispatcher.getNamespace_ = function(action) {
  return action.split('.')[0];
};


/**
 * Creates a jsaction.ActionFlow to be passed to an action handler.
 * @param {jsaction.EventInfo} eventInfo The event info.
 * @return {jsaction.ActionFlow} The newly created ActionFlow.
 * @private
 */
jsaction.Dispatcher.createActionFlow_ = function(eventInfo) {
  return new jsaction.ActionFlow(
      eventInfo['action'], eventInfo['actionElement'], eventInfo['event'],
      eventInfo['timeStamp'], eventInfo['eventType'],
      eventInfo['targetElement']);
};


/**
 * Registers multiple methods all bound to the same object
 * instance. This is a common case: an application module binds
 * multiple of its methods under public names to the event contract of
 * the application. So we provide a shortcut for it.
 * Attempts to replay the queued events after registering the handlers.
 *
 * @param {string} namespace The namespace of the jsaction name.
 *     NOTE(user): This is not optional in order to encourage uniform
 *     naming for all methods registered by a module.
 *
 * @param {Object} instance The object to bind the methods to. If this
 *     is null, then the functions are not bound, but directly added
 *     under the public names.
 *
 * @param {!Object.<string, function(jsaction.ActionFlow):void>} methods
 *     A map from public name to functions that will be bound
 *     to instance and registered as action under the public
 *     name. I.e. the property names are the public names. The
 *     property values are the methods of instance.
 */
jsaction.Dispatcher.prototype.registerHandlers = function(
    namespace, instance, methods) {
  goog.object.forEach(methods, goog.bind(function(method, name) {
    const handler = instance ? goog.bind(method, instance) : method;
    // Include a '.' separator between namespace name and action name.
    // In the case that no namespace name is provided, the jsaction name
    // consists of the action name only (no period).
    if (namespace) {
      const fullName =
          namespace + jsaction.Char.NAMESPACE_ACTION_SEPARATOR + name;
      this.actions_[fullName] = handler;
    } else {
      this.actions_[name] = handler;
    }
  }, this));

  this.replayQueuedEvents_();
};


/**
 * Unregisters an action.  Provided as an easy way to reverse the effects of
 * registerHandlers.
 * @param {string} namespace The namespace of the jsaction name.
 * @param {string} name The action name to unbind.
 */
jsaction.Dispatcher.prototype.unregisterHandler = function(namespace, name) {
  const fullName = namespace ?
      namespace + jsaction.Char.NAMESPACE_ACTION_SEPARATOR + name :
      name;
  delete this.actions_[fullName];
};


/**
 * Registers a global event handler.
 * @param {string} eventType
 * @param {function(!Event):(boolean|undefined)} handler
 */
jsaction.Dispatcher.prototype.registerGlobalHandler = function(
    eventType, handler) {
  this.globalHandlers_[eventType] = this.globalHandlers_[eventType] || [];
  this.globalHandlers_[eventType].push(handler);
};


/**
 * Unregisters a global event handler.
 * @param {string} eventType
 * @param {function(!Event):(boolean|undefined)} handler
 */
jsaction.Dispatcher.prototype.unregisterGlobalHandler = function(
    eventType, handler) {
  if (this.globalHandlers_[eventType]) {
    goog.array.remove(this.globalHandlers_[eventType], handler);
  }
};


/**
 * Checks whether there is an action registered under the given
 * name. This returns true if there is a namespace handler, even
 * if it can not yet handle the event.
 *
 * TODO(chrishenry): Remove this when canDispatch is used everywhere.
 *
 * @param {string} name Action name.
 * @return {boolean} Whether the name is registered.
 * @see #canDispatch
 */
jsaction.Dispatcher.prototype.hasAction = function(name) {
  return this.actions_.hasOwnProperty(name) ||
      this.namespaceActions_.hasOwnProperty(
          jsaction.Dispatcher.getNamespace_(name));
};


/**
 * Whether this dispatcher can dispatch the event. This can be used by
 * event replayer to check whether the dispatcher can replay an event.
 * @param {jsaction.EventInfo} eventInfo
 * @return {boolean}
 */
jsaction.Dispatcher.prototype.canDispatch = function(eventInfo) {
  const name = eventInfo['action'];
  if (this.actions_.hasOwnProperty(name)) {
    return true;
  }
  const ns = jsaction.Dispatcher.getNamespace_(name);
  if (this.namespaceActions_.hasOwnProperty(ns)) {
    return this.namespaceActions_[ns].accept(eventInfo);
  }
  return false;
};


/**
 * Replays queued events, if any. The replaying will happen in its own
 * stack once the current flow cedes control. This is done to mimic
 * browser event handling.
 */
jsaction.Dispatcher.prototype.replay = function() {
  this.replayQueuedEvents_();
};


/**
 * Replays queued events, if any. The replaying will happen in its own
 * stack once the current flow cedes control. As opposed to the replay()
 * method, the replay happens immediately.
 */
jsaction.Dispatcher.prototype.replayNow = function() {
  if (!this.eventReplayer_ || goog.array.isEmpty(this.queue_)) {
    return;
  }
  this.eventReplayer_(this.queue_, this);
};


/**
 * Replays queued events. The replaying will happen in its own stack once the
 * current flow cedes control. This is done to mimic browser event handling.
 * @private
 */
jsaction.Dispatcher.prototype.replayQueuedEvents_ = function() {
  if (!this.eventReplayer_ || goog.array.isEmpty(this.queue_)) {
    return;
  }
  goog.async.run(function() {
    this.eventReplayer_(this.queue_, this);
  }, this);
};


/**
 * Sets the event replayer, enabling queued events to be replayed when actions
 * are bound. After setting the event replayer, tries to replay queued events.
 * The event replayer takes as parameters the queue of events and the dispatcher
 * (used to check whether actions have handlers registered and can be replayed).
 * The event replayer is also responsible for dequeuing events.
 *
 * Example: An event replayer that replays only the last event.
 *
 *   const dispatcher = new Dispatcher;
 *   // ...
 *   dispatcher.setEventReplayer(function(queue, dispatcher) {
 *     const lastEventInfo = goog.array.peek(queue);
 *     if (dispatcher.canDispatch(lastEventInfo.action) {
 *       jsaction.replay.replayEvent(lastEventInfo);
 *       goog.array.clear(queue);
 *     }
 *   });
 *
 * @param {function(!Array.<jsaction.EventInfo>, !jsaction.Dispatcher):void}
 *    eventReplayer It allows elements to be replayed and dequeuing.
 */
jsaction.Dispatcher.prototype.setEventReplayer = function(eventReplayer) {
  this.eventReplayer_ = eventReplayer;
  this.replayQueuedEvents_();
};
