// Copyright 2005 Google Inc. All Rights Reserved.


goog.provide('jsaction.Dispatcher');
goog.provide('jsaction.Loader');

goog.require('goog.array');
goog.require('goog.functions');
goog.require('goog.object');
goog.require('jsaction.ActionFlow');
goog.require('jsaction.Branch');
goog.require('jsaction.Char');
goog.require('jsaction.event');


/**
 * A loader is a function that will do whatever is necessary to register
 * handlers for a given namespace. A loader takes a dispatcher and a namespace
 * as parameters.
 * @typedef {function(!jsaction.Dispatcher,string):void}
 */
jsaction.Loader;


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
 * @constructor
 */
jsaction.Dispatcher = function(opt_flowFactory, opt_getHandler) {
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

  /**
   * The ActionFlow factory.
   * @type {function(jsaction.EventInfo):jsaction.ActionFlow}
   * @private
   */
  this.flowFactory_ = opt_flowFactory || jsaction.Dispatcher.createActionFlow_;

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
 * @param {(jsaction.EventInfo|!Array.<jsaction.EventInfo>)} eventInfo
 *    The info for the event that triggered this call or the queue of events
 *    from EventContract.
 * @param {boolean=} opt_globalDispatch If true, dispatches a global event
 *    instead of a regular jsaction handler.
 */
jsaction.Dispatcher.prototype.dispatch = function(
    eventInfo, opt_globalDispatch) {
  if (goog.isArray(eventInfo)) {
    // We received the queued events from EventContract. Copy them and try to
    // replay.
    this.queue_ = goog.array.clone(eventInfo);
    this.replayQueuedEvents_();
    return;
  }

  if (opt_globalDispatch) {
    // Skip everything related to jsaction handlers, and execute the global
    // handlers.
    var ev = eventInfo['event'];
    var eventTypeHandlers = this.globalHandlers_[eventInfo['eventType']];
    if (eventTypeHandlers) {
      var shouldPreventDefault = false;
      for (var i = 0, handler; handler = eventTypeHandlers[i++];) {
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

  var action = eventInfo['action'];
  var namespace = jsaction.Dispatcher.getNamespace_(action);
  var namespaceAction = this.namespaceActions_[namespace];

  var handler;
  if (this.getHandler_) {
    handler = this.getHandler_(eventInfo);
  } else if (!namespaceAction) {
    handler = this.actions_[action];
  } else if (namespaceAction.accept(eventInfo)) {
    handler = namespaceAction.handle;
  }

  if (handler) {
    var stats = this.flowFactory_(
        /** @type {jsaction.EventInfo} */ (eventInfo));
    handler(stats);
    stats.done(jsaction.Branch.MAIN);
    return;
  }

  // No handler was found. Potentially make a copy of the event to extend its
  // life and queue it.
  var eventCopy = jsaction.event.maybeCopyEvent(eventInfo['event']);
  eventInfo['event'] = eventCopy;
  this.queue_.push(eventInfo);

  if (!namespaceAction) {
    // If there is no handler, check if there is a loader available.
    // If there already is a handler for the namespace, but it is not
    // yet ready to accept the event, then the namespace handler
    // might load handlers on its own, and will call replay() later.
    this.maybeInvokeLoader_(namespace);
  }
};


/**
 * Registers a loader function to be called in case a jsaction is encountered
 * for which there is no handler registered.
 * The loader is expected to register the jsaction handlers for the given
 * namespace.
 *
 * @param {string} actionNamespace The action namespace.
 * @param {jsaction.Loader} loaderFn The loader that will install the action
 *     handlers for this namespace. It takes the dispatcher and the namespace
 *     as parameters.
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
 * @private
 */
jsaction.Dispatcher.prototype.maybeInvokeLoader_ = function(namespace) {
  var loaderInfo = this.loaders_[namespace];
  if (!loaderInfo) {
    if (this.defaultLoader_ && !(namespace in this.defaultLoaderNamespaces_)) {
      this.defaultLoaderNamespaces_[namespace] = true;
      this.defaultLoader_(this, namespace);
    }
  } else if (!loaderInfo.called) {
    loaderInfo.loader(this, namespace);
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
      eventInfo['timeStamp'], eventInfo['eventType']);
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
    var handler = instance ? goog.bind(method, instance) : method;
    // Include a '.' separator between namespace name and action name.
    // In the case that no namespace name is provided, the jsaction name
    // consists of the action name only (no period).
    if (namespace) {
      var fullName = namespace + jsaction.Char.NAMESPACE_ACTION_SEPARATOR +
          name;
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
  var fullName = null;
  if (namespace) {
    fullName = namespace + jsaction.Char.NAMESPACE_ACTION_SEPARATOR + name;
  } else {
    fullName = name;
  }
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
  var name = eventInfo['action'];
  if (this.actions_.hasOwnProperty(name)) {
    return true;
  }
  var ns = jsaction.Dispatcher.getNamespace_(name);
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
 * Replays queued events. The replaying will happen in its own stack once the
 * current flow cedes control. This is done to mimic browser event handling.
 * @private
 */
jsaction.Dispatcher.prototype.replayQueuedEvents_ = function() {
  if (!this.eventReplayer_ || goog.array.isEmpty(this.queue_)) {
    return;
  }
  goog.global.setTimeout(goog.bind(function() {
    this.eventReplayer_(this.queue_, this);
  }, this), 0);
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
 *   var dispatcher = new Dispatcher;
 *   // ...
 *   dispatcher.setEventReplayer(function(queue, dispatcher) {
 *     var lastEventInfo = goog.array.peek(queue);
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
