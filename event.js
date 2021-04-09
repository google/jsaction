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
 *   timeStamp: number,
 *   needsRetrigger: (boolean|undefined),
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
 * ActionInfo can override the original event with the one provided here (field
 * "event"). If it's not provided, the original event is used.
 *
 * @typedef {{
 *   eventType: string,
 *   action: string,
 *   event: (Event|undefined|null),
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
 * A function used to initialize containers in
 * EventContract.addContainer(). Such a function is passed an HTML DOM
 * Element and registers a specific event handler on it. The
 * EventHandlerInfo that is needed to eventually deregister the event
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
  let capture = false;

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
 * Gets the target Element of the event. In IE8 and older the 'target' property
 * is not supported and the 'srcElement' property has to be used instead. In
 * Firefox, a text node may appear as the target of the event, in which case
 * we return the parent element of the text node.
 * @param {!Event} e The event to get the target of.
 * @return {!Element} The target element.
 */
jsaction.event.getTarget = function(e) {
  // In IE8 and older the 'target' property is not supported and the
  // 'srcElement' property has to be used instead.
  let el = e.target || e.srcElement;

  // In Firefox, the event may have a text node as its target. We always
  // want the parent Element the text node belongs to, however.
  if (!el.getAttribute && el.parentNode) {
    el = el.parentNode;
  }

  return /** @type {!Element} */ (el);
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
 * @const {boolean}
 */
jsaction.event.isWebKit = typeof navigator != 'undefined' &&
    !/Opera/.test(navigator.userAgent) &&
    /WebKit/.test(navigator.userAgent);


/**
 * Whether we are on Safari.
 * @const {boolean}
 */
jsaction.event.isSafari = typeof navigator != 'undefined' &&
    /WebKit/.test(navigator.userAgent) &&
    /Safari/.test(navigator.userAgent);


/**
 * Whether we are on IE.
 * @const {boolean}
 */
jsaction.event.isIe = typeof navigator != 'undefined' &&
    (/MSIE/.test(navigator.userAgent) ||
    /Trident/.test(navigator.userAgent));


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
 * @param {!Element} el The element.
 * @return {boolean} Whether the given element is a valid action key target.
 * @private
 */
jsaction.event.isValidActionKeyTarget_ = function(el) {
  if (!('getAttribute' in el)) {
    return false;
  }
  if (jsaction.event.isTextControl_(el)) {
    return false;
  }
  if (jsaction.event.isNativelyActivatable_(el)) {
    return false;
  }
  if (el.isContentEditable) {
    return false;
  }

  return true;
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
  const el = jsaction.event.getTarget(e);
  const tagName = el.tagName.toUpperCase();
  const role = (el.getAttribute('role') || '').toUpperCase();

  if (tagName === 'BUTTON' || role === 'BUTTON') {
    return true;
  }
  if (!jsaction.event.isNativeHTMLControl(el)) {
    return false;
  }
  if (tagName === 'A') {
    return false;
  }
  /**
   * Fix for physical d-pads on feature phone platforms; the native event
   * (ie. isTrusted: true) needs to fire to show the OPTION list. See
   * b/135288469 for more info.
   */
  if (tagName === 'SELECT') {
    return false;
  }
  if (jsaction.event.processSpace_(el)) {
    return false;
  }
  if (jsaction.event.isTextControl_(el)) {
    return false;
  }
  return true;
};


/**
 * Determines and returns whether the given event acts like a regular DOM click,
 * and should be handled instead of the click.  If this returns true, the caller
 * will call preventDefault() to prevent a possible duplicate event.
 * This is represented by a keypress (keydown on Gecko browsers) on Enter or
 * Space key.
 * @param {!Event} e The event.
 * @return {boolean} True, if the event emulates a DOM click.
 */
jsaction.event.isActionKeyEvent = function(e) {
  let key = e.which || e.keyCode;
  if (jsaction.event.isWebKit && key == jsaction.KeyCodes.MAC_ENTER) {
    key = jsaction.KeyCodes.ENTER;
  }
  if (key != jsaction.KeyCodes.ENTER && key != jsaction.KeyCodes.SPACE) {
    return false;
  }
  const el = jsaction.event.getTarget(e);
  if (e.type != jsaction.EventType.KEYDOWN ||
      !jsaction.event.isValidActionKeyTarget_(el) ||
      jsaction.event.hasModifierKey_(e)) {
    return false;
  }

  // For <input type="checkbox">, we must only handle the browser's native click
  // event, so that the browser can toggle the checkbox.
  if (jsaction.event.processSpace_(el) && key == jsaction.KeyCodes.SPACE) {
    return false;
  }

  // If this element is non-focusable, ignore stray keystrokes (b/18337209)
  // Sscreen readers can move without tab focus, so any tabIndex is focusable.
  // See B/21809604
  if (!jsaction.event.isFocusable_(el)) {
    return false;
  }

  const type = (el.getAttribute('role') || el.type || el.tagName).toUpperCase();
  const isSpecificTriggerKey =
      jsaction.event.IDENTIFIER_TO_KEY_TRIGGER_MAPPING[type] % key == 0;
  const isDefaultTriggerKey =
      !(type in jsaction.event.IDENTIFIER_TO_KEY_TRIGGER_MAPPING) &&
      key == jsaction.KeyCodes.ENTER;
  const hasType = el.tagName.toUpperCase() != 'INPUT' || !!el.type;
  return (isSpecificTriggerKey || isDefaultTriggerKey) && hasType;
};


/**
 * Checks whether a DOM element can receive keyboard focus.
 * This code is based on goog.dom.isFocusable, but simplified since we shouldn't
 * care about visibility if we're already handling a keyboard event.
 * @param {!Element} el
 * @return {boolean}
 * @private
 */
jsaction.event.isFocusable_ = function(el) {
  return (el.tagName in jsaction.event.NATIVELY_FOCUSABLE_ELEMENTS_ ||
      jsaction.event.hasSpecifiedTabIndex_(el)) &&
      !el.disabled;
};


/**
 * @param {!Element} element Element to check.
 * @return {boolean} Whether the element has a specified tab index.
 * @private
 */
jsaction.event.hasSpecifiedTabIndex_ = function(element) {
  // IE returns 0 for an unset tabIndex, so we must use getAttributeNode(),
  // which returns an object with a 'specified' property if tabIndex is
  // specified.  This works on other browsers, too.
  const attrNode = element.getAttributeNode('tabindex'); // Must be lowercase!
  return attrNode != null && attrNode.specified;
};


/**
 * Element tagnames that are focusable by default.
 * @private {!Object<string, number>}
 */
jsaction.event.NATIVELY_FOCUSABLE_ELEMENTS_ = {
  'A': 1,
  'INPUT': 1,
  'TEXTAREA': 1,
  'SELECT': 1,
  'BUTTON': 1
};


/**
 * @param {!Event} e
 * @return {boolean} True, if the Space key was pressed.
 */
jsaction.event.isSpaceKeyEvent = function(e) {
  const key = e.which || e.keyCode;
  const el = jsaction.event.getTarget(e);
  const elementName = (el.type || el.tagName).toUpperCase();
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
  const related = /** @type {!Node} */ (e.relatedTarget);

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
  const copy = {};
  for (const i in e) {
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
 * Returns touch data extracted from the touch event: clientX, clientY, screenX
 * and screenY. If the event has no touch information at all, the returned
 * value is null.
 *
 * The fields of this Object are unquoted.
 *
 * @param {!Event} event A touch event.
 * @return {?{clientX: number, clientY: number, screenX: number,
 *     screenY: number}}
 */
jsaction.event.getTouchData = function(event) {
  const touch = (event.changedTouches && event.changedTouches[0]) ||
      (event.touches && event.touches[0]);
  if (!touch) {
    return null;
  }
  return {
    clientX: touch['clientX'],
    clientY: touch['clientY'],
    screenX: touch['screenX'],
    screenY: touch['screenY']
  };
};


/**
 * Creates a new EventLike object for a "click" event that's derived from the
 * original corresponding "touchend" event for a fast-click implementation.
 *
 * It takes a touch event, adds common fields found in a click event and
 * changes the type to 'click', so that the resulting event looks more like
 * a real click event.
 *
 * @param {!Event} event A touch event.
 * @return {!Object} A modified event-like object copied from the event object
 *     passed into this function.
 */
jsaction.event.recreateTouchEventAsClick = function(event) {
  const click = {};
  click['originalEventType'] = event.type;
  click['type'] = jsaction.EventType.CLICK;
  for (const p in event) {
    const v = event[p];
    if (p != 'type' && p != 'srcElement' && !(typeof v === 'function')) {
      click[p] = v;
    }
  }

  // TODO(ruilopes): b/18978823 - refactor constants in a enum
  // Ensure that the event has the most recent timestamp. This timestamp
  // may be used in the future to validate or cancel subsequent click events.
  click['timeStamp'] = goog.now();

  // Emulate preventDefault and stopPropagation behavior
  click['defaultPrevented'] = false;
  click['preventDefault'] = jsaction.event.syntheticPreventDefault_;
  click['_propagationStopped'] = false;
  click['stopPropagation'] = jsaction.event.syntheticStopPropagation_;

  // Emulate click coordinates using touch info
  const touch = jsaction.event.getTouchData(event);
  if (touch) {
    click['clientX'] = touch.clientX;
    click['clientY'] = touch.clientY;
    click['screenX'] = touch.screenX;
    click['screenY'] = touch.screenY;
  }
  return click;
};


/**
 * Returns whether the mouse-event canceling has been requested for this
 * event. Currently only defined for "touchend" event.
 * @param {!Event} event A touch event.
 * @return {boolean}
 * @package
 */
jsaction.event.isMouseEventsPrevented = function(event) {
  return !!event['_mouseEventsPrevented'];
};


/**
 * Instructs system to cancel mouse events that follow the specified touch
 * event. Currently only defined for "touchend" event.
 * @param {!Event} event A touch event.
 * @package
 */
jsaction.event.preventMouseEvents = function(event) {
  event['_mouseEventsPrevented'] = true;
};


/**
 * An implementation of "_preventMouseEvents" method to the specified event.
 * Delegates implementation to "jsaction.event.preventMouseEvents".
 * @this {!Event}
 * @private
 */
jsaction.event.syntheticPreventMouseEvents_ = function() {
  jsaction.event.preventMouseEvents(this);
};


/**
 * Adds unobfuscated "_preventMouseEvents" method to the Event. This method can
 * be further included in externs for compilation support. This method
 * starts with "_" to prevent potential namespace conflict with standard Event's
 * methods.
 * @param {!Event} event
 * @package
 */
jsaction.event.addPreventMouseEventsSupport = function(event) {
  event['_preventMouseEvents'] = jsaction.event.syntheticPreventMouseEvents_;
};


/**
 * An implementation of "preventDefault" for a synthesized event. Simply
 * sets "defaultPrevented" property to true.
 * @this {!Event}
 * @private
 */
jsaction.event.syntheticPreventDefault_ = function() {
  this['defaultPrevented'] = true;
};


/**
 * An implementation of "stopPropagation" for a synthesized event. It simply
 * sets a synthetic non-standard "_propagationStopped" property to true.
 * @this {!Event}
 * @private
 */
jsaction.event.syntheticStopPropagation_ = function() {
  this['_propagationStopped'] = true;
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
  const doc = goog.global['document'];
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
  // NOTE(ruilopes): document.createEventObject is deprecated since IE 9. Its
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
  'FILE': 0,
  'GRIDCELL': jsaction.KeyCodes.ENTER,
  'LINK': jsaction.KeyCodes.ENTER,
  'LISTBOX': jsaction.KeyCodes.ENTER,
  'MENU': 0,
  'MENUBAR': 0,
  'MENUITEM': 0,
  'MENUITEMCHECKBOX': 0,
  'MENUITEMRADIO': 0,
  'OPTION': 0,
  'RADIO': jsaction.KeyCodes.SPACE,
  'RADIOGROUP': jsaction.KeyCodes.SPACE,
  'RESET': 0,
  //'SELECT': 0,
  'SUBMIT': 0,
  'SWITCH': jsaction.KeyCodes.SPACE,
  'TAB': 0,
  'TREE': jsaction.KeyCodes.ENTER,
  'TREEITEM': jsaction.KeyCodes.ENTER
};


/**
 * Returns whether or not to process space based on the type of the element;
 * checks to make sure that type is not null.
 * @param {!Element} element The element.
 * @return {boolean} Whether or not to process space based on type.
 * @private
 */
jsaction.event.processSpace_ = function(element) {
  const type = (element.getAttribute('type') || element.tagName).toUpperCase();
  return type in jsaction.event.PROCESS_SPACE_;
};


/**
 * Returns whether or not the given element is a text control.
 * @param {!Element} el The element.
 * @return {boolean} Whether or not the given element is a text control.
 * @private
 */
jsaction.event.isTextControl_ = function(el) {
  const type = (el.getAttribute('type') || el.tagName).toUpperCase();
  return type in jsaction.event.TEXT_CONTROLS_;
};


/**
 * Returns if the given element is a native HTML control.
 * @param {!Element} el The element.
 * @return {boolean} If the given element is a native HTML control.
 */
jsaction.event.isNativeHTMLControl = function(el) {
  return el.tagName.toUpperCase() in jsaction.event.NATIVE_HTML_CONTROLS_;
};

/**
 * Returns if the given element is natively activatable. Browsers emit click
 * events for natively activatable elements, even when activated via keyboard.
 * For these elements, we don't need to raise a11y click events.
 * @param {!Element} el The element.
 * @return {boolean} If the given element is a native HTML control.
 * @private
 */
jsaction.event.isNativelyActivatable_ = function(el) {
  return el.tagName.toUpperCase() == 'BUTTON' ||
      (el.type && el.type.toUpperCase() == 'FILE');
};



/**
 * HTML <input> types (not ARIA roles) which will auto-trigger a click event for
 * the Space key, with side-effects. We will not call preventDefault if space is
 * pressed, nor will we raise a11y click events.  For all other elements, we can
 * suppress the default event (which has no desired side-effects) and handle the
 * keydown ourselves.
 * @private @const {!Object<string, boolean>}
 */
jsaction.event.PROCESS_SPACE_ = {
  'CHECKBOX': true,
  'FILE': true,
  'OPTION': true,
  'RADIO': true
};


/**
 * TagNames and Input types for which to not process enter/space as click.
 * @private @const {!Object<string, boolean>}
 */
jsaction.event.TEXT_CONTROLS_ = {
  'COLOR': true,
  'DATE': true,
  'DATETIME': true,
  'DATETIME-LOCAL': true,
  'EMAIL': true,
  'MONTH': true,
  'NUMBER': true,
  'PASSWORD': true,
  'RANGE': true,
  'SEARCH': true,
  'TEL': true,
  'TEXT': true,
  'TEXTAREA': true,
  'TIME': true,
  'URL': true,
  'WEEK': true
};


/**
 * TagNames that are native HTML controls.
 * @private @const {!Object<string, boolean>}
 */
jsaction.event.NATIVE_HTML_CONTROLS_ = {
  'A': true,
  'AREA': true,
  'BUTTON': true,
  'DIALOG': true,
  'IMG': true,
  'INPUT': true,
  'LINK': true,
  'MENU': true,
  'OPTGROUP': true,
  'OPTION': true,
  'PROGRESS': true,
  'SELECT': true,
  'TEXTAREA': true
};
