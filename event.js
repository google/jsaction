// Copyright 2011 Google Inc. All Rights Reserved.

/**
 *
 * @fileoverview Functions that help jsaction deal with browser
 * events. We deliberately don't use the closure equivalents here
 * because we want to exercise very tight control over the
 * dependencies, because this code is meant to be inlined in the main
 * HTML page and therefore needs to be as small as possible.
 */

goog.provide('jsaction.ActionInfo');
goog.provide('jsaction.ContainerInitializerFunction');
goog.provide('jsaction.EventHandlerFunction');
goog.provide('jsaction.EventHandlerInfo');
goog.provide('jsaction.EventInfo');
goog.provide('jsaction.event');

goog.require('jsaction.EventType');
goog.require('jsaction.KeyCodes');
goog.require('jsaction.dom');


/**
 * Records information for later handling of events. This type is
 * shared, and instances of it are passed, between the eventcontract
 * and the dispatcher jsbinary. Therefore, the fields of this type are
 * referenced by string literals rather than property literals
 * throughout the code.
 *
 * 'targetElement' is the element the action occured on, 'actionElement'
 * is the element that has the jsaction handler.
 *
 * A null 'actionElement' identifies an EventInfo instance that didn't match a
 * jsaction attribute.  This allows us to execute global event handlers with the
 * appropriate event type (including a11y clicks and custom events).
 *
 * TODO(user): Using literals to access properties makes type
 * checking partially ineffective. Accessing a wrongly spelled field
 * this way doesn't create a compiler error, and passing such an
 * untyped field to a place where a type is expected doesn't create a
 * jscompiler error either. Assigning a value of the wrong type in
 * this way, however, does trigger a jscompiler error (seen when
 * assigning Event to 'target', which requires !Event).
 *
 * @typedef {{
 *   eventType: string,
 *   event: !Event,
 *   targetElement: !Element,
 *   action: string,
 *   actionElement: Element,
 *   timeStamp: number
 * }}
 */
jsaction.EventInfo;


/**
 * Records action information for a given event.  Since this type is only used
 * internally by the EventContract, we don't need to reference fields with
 * string literals (as opposed to jsaction.EventInfo).
 *
 * An empty 'action' identifies an ActionInfo instance that didn't match a
 * jsaction attribute.  This allows us to execute global event handlers with the
 * appropriate event type (including a11y clicks and custom events).
 *
 * @typedef {{
 *   eventType: string,
 *   action: string,
 *   ignore: boolean
 * }}
 */
jsaction.ActionInfo;


/**
 * The type of a DOM event handler function.
 * @typedef {function(this: Element, !Event)}
 */
jsaction.EventHandlerFunction;


/**
 * Information about a registered event handler, which can be used to
 * deregister the event handler.
 *
 * @typedef {{
 *   eventType: string,
 *   handler: jsaction.EventHandlerFunction,
 *   capture: boolean
 * }}
 */
jsaction.EventHandlerInfo;


/**
 * A function used to initialze containers in
 * EventContract.addContainer(). Such a function is passed an HTML DOM
 * Element and registers a specific event handler onm it. The
 * EventHandlerInfo that is needed to eventually deregister the evetn
 * handler is returned by that function.
 * @typedef {function(!Element):jsaction.EventHandlerInfo}
 */
jsaction.ContainerInitializerFunction;


/**
 * Registers the event handler function with the given DOM element for
 * the given event type. This function correctly handles registering
 * event handlers in IE using attachEvent(), and it properly deals
 * with the peculiar propagation of focus and blur.
 *
 * @param {!Element} element The element.
 * @param {string} eventType The event type.
 * @param {jsaction.EventHandlerFunction} handler The handler function
 *     to install.
 * @return {jsaction.EventHandlerInfo} Information needed to uninstall
 *     the event handler eventually.
 */
jsaction.event.addEventListener = function(element, eventType, handler) {
  // In the W3C DOM, all event handlers are registered in the bubbling
  // phase for compatibility with the IE event model, which only has a
  // bubbling phase. (IE's event API has event capture, but that's
  // something different.)
  //
  // The exception is focus and blur. For backwards compatibility with
  // the pre-bubbling event handlers, these events don't bubble at
  // all. The two event models compensate differently for this
  // limitation: IE provides a bubbling variant of these events,
  // focusin and focusout. W3C propagates focus and blur, but *only*
  // in the capturing phase, and it doesn't define focusin and
  // focusout.
  //
  // Therefore, the event contract handlers for focus and blur must be
  // treated special:
  //
  // * In W3C, we register them in the capture phase. This fact is
  //   recorded in EventInfo, so we can properly deregister them.
  //
  // * In IE, we register focusin and focuout, respectively. This fact
  //   is also recorded in EventInfo, so that it can be properly
  //   deregistered.
  //
  // It would be a bad idea to register all event handlers in the
  // capture phase because then regular onclick handlers would not be
  // executed at all on events that trigger a jsaction. That's not
  // entirely what we want, at least for now.
  //
  // Error and load events (i.e. on images) do not bubble so they are also
  // handled in the capture phase. These errors are also not supported in IE8
  // but we set them up here to be used in newer browsers.
  var capture = false;

  // Mouseenter and mouseleave events are not handled directly because they
  // are not available everywhere. In browsers where they are available, they
  // don't bubble and aren't visible at the container boundary. Instead, we
  // synthesize the mouseenter and mouseleave events from mouseover and
  // mouseout events, respectively. Cf. eventcontract.js.
  if (eventType == jsaction.EventType.MOUSEENTER) {
    eventType = jsaction.EventType.MOUSEOVER;
  } else if (eventType == jsaction.EventType.MOUSELEAVE) {
    eventType = jsaction.EventType.MOUSEOUT;
  }

  if (element.addEventListener) {
    if (eventType == jsaction.EventType.FOCUS ||
        eventType == jsaction.EventType.BLUR ||
        eventType == jsaction.EventType.ERROR ||
        eventType == jsaction.EventType.LOAD) {
      capture = true;
    }
    element.addEventListener(
        eventType, /** @type {EventListener} */(handler), capture);

  } else if (element.attachEvent) {
    if (eventType == jsaction.EventType.FOCUS) {
      eventType = jsaction.EventType.FOCUSIN;
    } else if (eventType == jsaction.EventType.BLUR) {
      eventType = jsaction.EventType.FOCUSOUT;
    }
    // IE doesn't call handler as method of element (thus 'this' isn't
    // set to element), and doesn't pass the Event instance as
    // argument. The adapter used here takes care of both.
    //
    // It's important that this adapter is deregistered eventually,
    // otherwise it constitutes a memory leak.
    //
    // Redefining the argument handler is done for utmost
    // conciseness. Better style would be more verbose. This needs to
    // be done such that the adapter rather than the original handler
    // is returned in event info, because that must be used to
    // eventually unregister this handler.
    handler = jsaction.event.attachEventAdapter_(element, handler);
    element.attachEvent('on' + eventType, handler);
  }
  return {eventType: eventType, handler: handler, capture: capture};
};


/**
 * In an event handler registered in IE, 'this' doesn't refer to the
 * Element the event handler is bound to, and the Event instance isn't
 * passed to the event handler as an argument, but is in the global
 * property window.event. This creates a wrapper around an normal
 * event handler that adapts these two aspects.
 *
 * It's important that this adapter is deregistered eventually,
 * otherwise it will create a memory leak.
 *
 * @param {!Element} target The Element instance on which the handler
 *     is installed.
 * @param {jsaction.EventHandlerFunction} handler The handler to adapt
 *     to.
 * @return {jsaction.EventHandlerFunction} The adapted handler
 *     function.
 * @private
 */
jsaction.event.attachEventAdapter_ = function(target, handler) {
  return function(e) {
    // Internet Explorer passes the event details through the global
    // window.event property. Although this handler wrapper is meant
    // to be used in IE, it actually is used when the attachEvent()
    // method is present. This is the case at least in Opera/7 on the
    // window object. Thus, we again detect features here, not
    // browsers.
    if (!e) {
      e = window.event;
    }
    return handler.call(target, e);
  };
};


/**
 * Removes the event handler for the given event from the element.
 * the given event type.
 *
 * @param {!Element} element The element.
 * @param {jsaction.EventHandlerInfo} info The information
 *     needed to deregister the handler, as returned by
 *     addEventListener(), above.
 */
jsaction.event.removeEventListener = function(element, info) {
  if (element.removeEventListener) {
    element.removeEventListener(
        info.eventType,
        /** @type {EventListener} */(info.handler),
        info.capture);
  } else if (element.detachEvent) {
    element.detachEvent('on' + info.eventType, info.handler);
  }
};


/**
 * Cancels propagation of an event.
 * @param {!Event} e The event to cancel propagation for.
 */
jsaction.event.stopPropagation = function(e) {
  e.stopPropagation ? e.stopPropagation() : (e.cancelBubble = true);
};


/**
 * Prevents the default action of an event.
 * @param {!Event} e The event to prevent the default action for.
 */
jsaction.event.preventDefault = function(e) {
  e.preventDefault ? e.preventDefault() : (e.returnValue = false);
};


/**
 * Gets the target of the event.  In IE8 and older the 'target' property
 * is not support and the 'srcElement' property has to be used instead.
 * @param {!Event} e The event to get the target of.
 * @return {!Element} The target element.
 */
jsaction.event.getTarget = function(e) {
  return /** @type {!Element} */ (e.target || e.srcElement);
};


/**
 * Whether we are on a Mac. Not pulling in useragent just for this.
 * NOTE(izaakr): navigator does not exist in google_js_test, hence the test
 * for its existence.
 * @type {boolean}
 * @private
 */
jsaction.event.isMac_ = typeof navigator != 'undefined' &&
    /Macintosh/.test(navigator.userAgent);


/**
 * Determines and returns whether the given event (which is assumed to be a
 * click event) is a middle click.
 * NOTE(user): There is not a consistent way to identify middle click
 * across all browsers. Some detailed information about this can be found at:
 * http://www.unixpapa.com/js/mouse.html
 * @param {!Event} e The event.
 * @return {boolean} Whether the given event is a middle click.
 * @private
 */
jsaction.event.isMiddleClick_ = function(e) {
  return (e.which == 2) ||
      (e.which == null && e.button == 4); /* middle click for IE */
};


/**
 * Determines and returns whether the given event (which is assumed
 * to be a click event) is modified. A middle click is considered a modified
 * click to retain the default browser action, which opens a link in a new tab.
 * @param {!Event} e The event.
 * @return {boolean} Whether the given event is modified.
 */
jsaction.event.isModifiedClickEvent = function(e) {
  return (jsaction.event.isMac_ && e.metaKey) ||
      (!jsaction.event.isMac_ && e.ctrlKey) ||
      jsaction.event.isMiddleClick_(e) ||
      e.shiftKey;
};


/**
 * Whether we are on WebKit (e.g., Chrome).
 * @private {boolean}
 */
jsaction.event.isWebKit_ = typeof navigator != 'undefined' &&
    !/Opera/.test(navigator.userAgent) &&
    /WebKit/.test(navigator.userAgent);


/**
 * Whether we are on Gecko (e.g., Firefox).
 * @type {boolean}
 */
jsaction.event.isGecko = typeof navigator != 'undefined' &&
    !/Opera|WebKit/.test(navigator.userAgent) &&
    /Gecko/.test(navigator.product);


/**
 * Determines and returns whether the given element is a valid target for
 * keypress/keydown DOM events that act like regular DOM clicks.
 * @param {!Element} element The element.
 * @return {boolean} Whether the given element is a valid action key target.
 * @private
 */
jsaction.event.isValidActionKeyTarget_ = function(element) {
  if (!('getAttribute' in element)) {
    return false;
  }
  var tagName = (
      element.getAttribute('role') || element.type || element.tagName).
      toUpperCase();
  return tagName != 'TEXT' &&
      tagName != 'TEXTAREA' &&
      tagName != 'PASSWORD' &&
      tagName != 'SEARCH' &&
      (tagName != 'COMBOBOX' || element.tagName.toUpperCase() != 'INPUT') &&
      !element.isContentEditable;
};


/**
 * Whether an event has a modifier key activated.
 * @param {!Event} e The event.
 * @return {boolean} True, if a modifier key is activated.
 * @private
 */
jsaction.event.hasModifierKey_ = function(e) {
  return e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;
};


/**
 * Determines and returns whether the given event has a target that already
 * has event handlers attached because it is a native HTML control. Used to
 * determine if preventDefault should be called when isActionKeyEvent is true.
 * @param {!Event} e The event.
 * @return {boolean} If preventDefault should be called.
 */
jsaction.event.shouldCallPreventDefaultOnNativeHtmlControl = function(e) {
  var el = jsaction.event.getTarget(e);
  var elementName = (el.getAttribute('role') || el.tagName).toUpperCase();
  var type = el.type;
  return elementName == 'BUTTON' || !!type &&
      !(type.toUpperCase() in jsaction.event.PROCESS_SPACE);
};


/**
 * Determines and returns whether the given event acts like a regular DOM click.
 * This is represented by a keypress (keydown on Gecko browsers) on Enter or
 * Space key.
 * @param {!Event} e The event.
 * @return {boolean} True, if the event emulates a DOM click.
 */
jsaction.event.isActionKeyEvent = function(e) {
  var key = e.which || e.keyCode || e.key;
  if (jsaction.event.isWebKit_ && key == jsaction.KeyCodes.MAC_ENTER) {
    key = jsaction.KeyCodes.ENTER;
  }
  var el = jsaction.event.getTarget(e);
  var id = (el.getAttribute('role') || el.type || el.tagName).toUpperCase();
  var kCodes = key == jsaction.KeyCodes.ENTER || key == jsaction.KeyCodes.SPACE;
  var validTypeMods = e.type == jsaction.EventType.KEYDOWN &&
      jsaction.event.isValidActionKeyTarget_(el) &&
      !jsaction.event.hasModifierKey_(e);
  var noType = el.tagName.toUpperCase() == 'INPUT' && !el.type;
  var inMap = jsaction.event.IDENTIFIER_TO_KEY_TRIGGER_MAPPING[id] % key == 0;
  var notInMap = !(id in jsaction.event.IDENTIFIER_TO_KEY_TRIGGER_MAPPING) &&
      key == jsaction.KeyCodes.ENTER;
  // To prevent false negatives when bubbling
  var origTar = !!e.originalTarget && e.originalTarget != el;
  return validTypeMods && kCodes && ((inMap || notInMap) && !noType || origTar);
};


/**
 * @param {!Event} e
 * @return {boolean} True, if the Space key was pressed.
 */
jsaction.event.isSpaceKeyEvent = function(e) {
  var key = e.which || e.keyCode || e.key;
  var el = jsaction.event.getTarget(e);
  var elementName = (el.type || el.tagName).toUpperCase();
  return key == jsaction.KeyCodes.SPACE && elementName != 'CHECKBOX';
};


/**
 * Determines whether the event corresponds to a non-bubbling mouse
 * event type (mouseenter and mouseleave).
 *
 * During mouseover (mouseenter), the relatedTarget is the element being
 * entered from. During mouseout (mouseleave), the relatedTarget is the
 * element being exited to.
 *
 * In both cases, if relatedTarget is outside target, then the corresponding
 * special event has occurred, otherwise it hasn't.
 *
 * @param {!Event} e The mouseover/mouseout event.
 * @param {string} type The type of the mouse special event.
 * @param {!Element} element The element on which the jsaction for the
 *     mouseenter/mouseleave event is defined.
 * @return {boolean} True if the event is a mouseenter/mouseleave event.
 */
jsaction.event.isMouseSpecialEvent = function(e, type, element) {
  var related = /** @type {!Node} */ (e.relatedTarget);

  return ((e.type == jsaction.EventType.MOUSEOVER &&
           type == jsaction.EventType.MOUSEENTER) ||
          (e.type == jsaction.EventType.MOUSEOUT &&
           type == jsaction.EventType.MOUSELEAVE)) &&
          (!related || (related !== element &&
           !jsaction.dom.contains(element, related)));
};


/**
 * Creates a new EventLike object for a mouseenter/mouseleave event that's
 * derived from the original corresponding mouseover/mouseout event.
 * @param {!Event} e The event.
 * @param {!Element} target The element on which the jsaction for the
 *     mouseenter/mouseleave event is defined.
 * @return {!Object} A modified event-like object copied from the event object
 *     passed into this function.
 */
jsaction.event.createMouseSpecialEvent = function(e, target) {
  // We have to create a copy of the event object because we need to mutate
  // its fields. We do this for the special mouse events because the event
  // target needs to be retargeted to the action element rather than the real
  // element (since we are simulating the special mouse events with mouseover/
  // mouseout).
  //
  // Since we're making a copy anyways, we might as well attempt to convert
  // this event into a pseudo-real mouseenter/mouseleave event by adjusting
  // its type.
  var copy = {};
  for (var i in e) {
    if (typeof e[i] === 'function' || i === 'srcElement' || i === 'target') {
      continue;
    }
    copy[i] = e[i];
  }
  if (e.type == jsaction.EventType.MOUSEOVER) {
    copy['type'] = jsaction.EventType.MOUSEENTER;
  } else {
    copy['type'] = jsaction.EventType.MOUSELEAVE;
  }
  copy['target'] = copy['srcElement'] = target;
  copy['bubbles'] = false;
  return copy;
};


/**
 * Returns a copy of the event that is safe to keep a reference to.
 * For all non-IE browsers, it is safe to keep the existing event, but
 * since older versions of IE reuse and clobber the same Event object
 * each time a handler is called, we need to make an explicit copy.
 *
 * @param {!Event} e The event to be copied.
 * @return {!Event} The event copy.
 * TODO(user): Add tests for this function.
 */
jsaction.event.maybeCopyEvent = function(e) {
  var doc = goog.global['document'];
  // We test the following:
  //
  // The document may not exist in dom-less tests.
  //
  // The absence of document.createEvent signals that we're on an
  // older version of IE, which needs to copy the event.  In contrast,
  // when document.createEvent is defined we do not have to copy.
  //
  // The method document.createEventObject, if present, is the IE supported
  // way to copy the event but it should only be used in older versions of
  // IE, ones which do not define document.createEvent.
  //
  // Doc.createEventObject fails for non-browser events (such as custom events),
  // but those do not require copying, so we just return the existing event.
  //
  // NOTE(user): document.createEventObject is deprecated since IE 9. Its
  // usage is disallowed in IE 9 standards document mode. More information at
  // http://msdn.microsoft.com/en-us/library/ff986080(v=vs.85)
  if (doc && !doc.createEvent && doc.createEventObject) {
    try {
      return doc.createEventObject(e);
    } catch (ignore) {
      // Copying the event fails. Assume that this is because the event was
      // not a browser event and thus does not require copying.
      return e;
    }
  } else {
    return e;
  }
};


/**
 * Mapping of HTML element identifiers (ARIA role, type, or tagName) to the
 * keys (enter and/or space) that should activate them. A value of zero means
 * that both should activate them.
 * @const {!Object.<string, number>}
 */
jsaction.event.IDENTIFIER_TO_KEY_TRIGGER_MAPPING = {
  'A': jsaction.KeyCodes.ENTER,
  'BUTTON': 0,
  'CHECKBOX': jsaction.KeyCodes.SPACE,
  'COMBOBOX': jsaction.KeyCodes.ENTER,
  'LINK': jsaction.KeyCodes.ENTER,
  'LISTBOX': jsaction.KeyCodes.ENTER,
  'MENU': 0,
  'MENUBAR': 0,
  'MENUITEM': 0,
  'MENUITEMCHECKBOX': 0,
  'MENUITEMRADIO': 0,
  'OPTION': jsaction.KeyCodes.ENTER,
  'RADIO': jsaction.KeyCodes.SPACE,
  'RADIOGROUP': jsaction.KeyCodes.SPACE,
  'RESET': 0,
  'SUBMIT': 0,
  'TAB': 0,
  'TABLIST': 0,
  'TREE': jsaction.KeyCodes.ENTER,
  'TREEITEM': jsaction.KeyCodes.ENTER
};


/**
 * HTML controls for which to not call preventDefault when space is pressed.
 * @const {!Object.<string, number>}
 */
jsaction.event.PROCESS_SPACE = {
  'CHECKBOX': 1,
  'OPTION': 1,
  'RADIO': 1
};
