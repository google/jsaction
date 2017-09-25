// Copyright 2011 Google Inc. All rights reserved.

/**
 *
 * @fileoverview Defines and documents the various lexical components
 * that make up the different aspects of the jsaction syntax.
 *
 * NOTE(user): Yep, the things defined here are lexical, but their
 * grouping and documentation is what defines the jsaction syntax.
 */

goog.provide('jsaction.Attribute');
goog.provide('jsaction.Branch');
goog.provide('jsaction.Char');
goog.provide('jsaction.EventType');
goog.provide('jsaction.KeyCodes');
goog.provide('jsaction.Name');
goog.provide('jsaction.Property');
goog.provide('jsaction.TagName');
goog.provide('jsaction.Tick');
goog.provide('jsaction.UrlParam');


/**
 * All attributes used by jsaction.
 * @enum {string}
 */
jsaction.Attribute = {
  /**
   * The jsaction attribute defines a mapping of a DOM event to a
   * generic event (aka jsaction), to which the actual event handlers
   * that implement the behavior of the application are bound. The
   * value is a semicolon separated list of colon separated pairs of
   * an optional DOM event name and a jsaction name. If the optional
   * DOM event name is omitted, 'click' is assumed. The jsaction names
   * are dot separated pairs of a namespace and a simple jsaction
   * name. If the namespace is absent, it is taken from the closest
   * ancestor element with a jsnamespace attribute, if there is
   * any. If there is no ancestor with a jsnamespace attribute, the
   * simple name is assumed to be the jsaction name.
   *
   * Used by EventContract.
   */
  JSACTION: 'jsaction',

  /**
   * The jsnamespace attribute provides the namespace part of the
   * jaction names occurring in the jsaction attribute where it's
   * missing.
   *
   * Used by EventContract.
   */
  JSNAMESPACE: 'jsnamespace',

  /**
   * The oi attribute is a log impression tag for impression logging
   * and action tracking. For an element that carries a jsaction
   * attribute, the element is identified for the purpose of
   * impression logging and click tracking by the dot separated path
   * of all oi attributes in the chain of ancestors of the element.
   *
   * Used by ActionFlow.
   */
  OI: 'oi',

  /**
   * The ved attribute is an encoded ClickTrackingCGI proto to track
   * visual elements.
   *
   * Used by ActionFlow.
   */
  VED: 'ved',

  /**
   * The vet attribute is the visual element type used to identify tracked
   * visual elements.
   */
  VET: 'vet',

  /**
   * Support for iteration on reprocessing.
   *
   * Used by ActionFlow.
   */
  JSINSTANCE: 'jsinstance',

  /**
   * All click jsactions that happen on the element that carries this
   * attribute or its descendants are automatically logged.
   * Impressions of jsactions on these elements are tracked too, if
   * requested by the impression() method of ActionFlow.
   *
   * Used by ActionFlow.
   */
  JSTRACK: 'jstrack'
};


/**
 * Special ActionFlow branch names defined by jsaction.
 * @enum {string}
 */
jsaction.Branch = {
  /**
   * The main branch, i.e. the branch the action flow instance starts
   * right at construction.
   */
  MAIN: 'main-actionflow-branch'
};


/** All special characters used by jsaction. */
jsaction.Char = {
  /**
   * The separator between the namespace and the action name in the
   * jsaction attribute value.
   */
  NAMESPACE_ACTION_SEPARATOR: '.',

  /**
   * The separator between the event name and action in the jsaction
   * attribute value.
   */
  EVENT_ACTION_SEPARATOR: ':',

  /**
   * The separator between the logged oi attribute values in the &oi=
   * URL parameter value.
   */
  OI_SEPARATOR: '.',

  /**
   * The separator between the key and the value pairs in the &cad=
   * URL parameter value.
   */
  CAD_KEY_VALUE_SEPARATOR: ':',

  /**
   * The separator between the key-value pairs in the &cad= URL
   * parameter value.
   */
  CAD_SEPARATOR: ','
};


/**
 * Names of events that are special to jsaction. These are not all
 * event types that are legal to use in either HTML or the addEvent()
 * API, but these are the ones that are treated specially. All other
 * DOM events can be used in either addEvent() or in the value of the
 * jsaction attribute. Beware of browser specific events or events
 * that don't bubble though: If they are not mentioned here, then
 * event contract doesn't work around their peculiarities.
 * @enum {string}
 */
jsaction.EventType = {
  /**
   * Mouse middle click, introduced in Chrome 55 and not yet supported on
   * other browsers.
   */
  AUXCLICK: 'auxclick',

  /**
   * The click event. In addEvent() refers to all click events, in the
   * jsaction attribute it refers to the unmodified click and Enter/Space
   * keypress events.  In the latter case, a jsaction click will be triggered,
   * for accessibility reasons.  See clickmod and clickonly, below.
   */
  CLICK: 'click',

  /**
   * Specifies the jsaction for a modified click event (i.e. a mouse
   * click with the modifier key Cmd/Ctrl pressed). This event isn't
   * separately enabled in addEvent(), because in the DOM, it's just a
   * click event.
   */
  CLICKMOD: 'clickmod',

  /**
   * Specifies the jsaction for a click-only event.  Click-only doesn't take
   * into account the case where an element with focus receives an Enter/Space
   * keypress.  This event isn't separately enabled in addEvent().
   */
  CLICKONLY: 'clickonly',

  /**
   * The dblclick event.
   */
  DBLCLICK: 'dblclick',

  /**
   * Focus doesn't bubble, but you can use it in addEvent() and
   * jsaction anyway. EventContract does the right thing under the
   * hood.
   */
  FOCUS: 'focus',

  /**
   * This event only exists in IE. For addEvent() and jsaction, use
   * focus instead; EventContract does the right thing even though
   * focus doesn't bubble.
   */
  FOCUSIN: 'focusin',

  /**
   * Analog to focus.
   */
  BLUR: 'blur',

  /**
   * Analog to focusin.
   */
  FOCUSOUT: 'focusout',

  /**
   * Submit doesn't bubble, so it cannot be used with event
   * contract. However, the browser helpfully fires a click event on
   * the submit button of a form (even if the form is not submitted by
   * a click on the submit button). So you should handle click on the
   * submit button instead.
   */
  SUBMIT: 'submit',

  /**
   * The keydown event. In addEvent() and non-click jsaction it represents the
   * regular DOM keydown event. It represents click actions in non-Gecko
   * browsers.
   */
  KEYDOWN: 'keydown',

  /**
   * The keypress event. In addEvent() and non-click jsaction it represents the
   * regular DOM keypress event. It represents click actions in Gecko browsers.
   */
  KEYPRESS: 'keypress',

  /**
   * The keyup event. In addEvent() and non-click jsaction it represents the
   * regular DOM keyup event. It represents click actions in non-Gecko
   * browsers.
   */
  KEYUP: 'keyup',

  /**
   * The mouseup event. Can either be used directly or used implicitly to
   * capture mouseup events. In addEvent(), it represents a regular DOM
   * mouseup event.
   */
  MOUSEUP: 'mouseup',

  /**
   * The mousedown event. Can either be used directly or used implicitly to
   * capture mouseenter events. In addEvent(), it represents a regular DOM
   * mouseover event.
   */
  MOUSEDOWN: 'mousedown',

  /**
   * The mouseover event. Can either be used directly or used implicitly to
   * capture mouseenter events. In addEvent(), it represents a regular DOM
   * mouseover event.
   */
  MOUSEOVER: 'mouseover',

  /**
   * The mouseout event. Can either be used directly or used implicitly to
   * capture mouseover events. In addEvent(), it represents a regular DOM
   * mouseout event.
   */
  MOUSEOUT: 'mouseout',

  /**
   * The mouseenter event. Does not bubble and fires individually on each
   * element being entered within a DOM tree.
   */
  MOUSEENTER: 'mouseenter',

  /**
   * The mouseleave event. Does not bubble and fires individually on each
   * element being entered within a DOM tree.
   */
  MOUSELEAVE: 'mouseleave',

  /**
   * The mousemove event.
   */
  MOUSEMOVE: 'mousemove',

  /**
   * The error event. The error event doesn't bubble, but you can use it in
   * addEvent() and jsaction anyway. EventContract does the right thing under
   * the hood (except in IE8 which does not use error events).
   */
  ERROR: 'error',

  /**
   * The load event. The load event doesn't bubble, but you can use it in
   * addEvent() and jsaction anyway. EventContract does the right thing
   * under the hood.
   */
  LOAD: 'load',

  /**
   * The unload event.
   */
  UNLOAD: 'unload',

  /**
   * The touchstart event. Bubbles, will only ever fire in browsers with
   * touch support.
   */
  TOUCHSTART: 'touchstart',

  /**
   * The touchend event. Bubbles, will only ever fire in browsers with
   * touch support.
   */
  TOUCHEND: 'touchend',

  /**
   * The touchmove event. Bubbles, will only ever fire in browsers with
   * touch support.
   */
  TOUCHMOVE: 'touchmove',

  /**
   * The input event.
   */
  INPUT: 'input',

  /**
   * The scroll event.
   */
  SCROLL: 'scroll',

  /**
   * A custom event. The actual custom event type is declared as the 'type'
   * field in the event details. Supported in Firefox 6+, IE 9+, and all Chrome
   * versions.
   *
   * This is an internal name. Users should use jsaction.fireCustomEvent to
   * fire custom events instead of relying on this type to create them.
   */
  CUSTOM: '_custom'
};


/**
 * Special keycodes used by jsaction for the generic click action.
 * @enum {number}
 */
jsaction.KeyCodes = {
  /**
   * If on a Macintosh with an extended keyboard, the Enter key located in the
   * numeric pad has a different ASCII code.
   */
  MAC_ENTER: 3,

  /**
   * The Enter key.
   */
  ENTER: 13,

  /**
   * The Space key.
   */
  SPACE: 32
};


/**
 * Special tag names used by jsaction for the generic click action.
 * @enum {string}
 */
jsaction.TagName = {
  /**
   * A textarea tag.
   */
  TEXTAREA: 'TEXTAREA',

  /**
   * An input tag.
   */
  INPUT: 'INPUT',

  /**
   * A button tag.
   */
  BUTTON: 'BUTTON',

  /**
   * An anchor tag.
   */
  A: 'A'
};


/**
 * Special names used by jsaction.
 * @enum {string}
 */
jsaction.Name = {
  /**
   * The start time property of ActionFlow. TODO(user): Maybe a Property?
   */
  START: 'start',

  /**
   * Click additional data.
   */
  CAD: 'cad',

  /**
   * Action data to track duplicate ticks. This is used as a key in
   * additionalData map and in the value of the CLICK_ADDITIONAL_DATA
   * URL parameter in the reporting request.
   */
  DUP: 'dup'
};


/**
 * All the CSI ticks issued by jsaction.
 * @enum {string}
 */
jsaction.Tick = {
  /**
   * Tick that indicates that the control flow enters ActionFlow.impression().
   */
  IMP0: 'imp0',

  /**
   * Tick that indicates that the control flow leaves impression().
   */
  IMP1: 'imp1'
};


/**
 * All properties that are used by jsaction.
 * @enum {string}
 */
jsaction.Property = {
  /**
   * The parsed value of the jsaction attribute is stored in this
   * property on the DOM node. The parsed value is an Object. The
   * property names of the object are the events; the values are the
   * names of the actions. This property is attached even on nodes
   * that don't have a jsaction attribute as an optimization, because
   * property lookup is faster than attribute access.
   */
  JSACTION: '__jsaction',

  /**
   * The parsed value of the jsnamespace attribute is stored in this
   * property on the DOM node.
   */
  JSNAMESPACE: '__jsnamespace',

  /**
   * The value of the oi attribute as a property, for faster access.
   */
  OI: '__oi',

  /**
   * The owner property references an a logical owner for a DOM node. JSAction
   * will follow this reference instead of parentNode when traversing the DOM
   * to find jsaction attributes. This allows overlaying a logical structure
   * over a document where the DOM structure can't reflect that structure.
   */
  OWNER: '__owner'
};


jsaction.UrlParam = {
  /**
   * The type of the click is the name of the jsaction it was mapped to.
   */
  CLICK_TYPE: 'ct',

  /**
   * Click data contains the positional index of the clicked element
   * among its sibling as given by the jsinstance attribute value, if
   * any.
   */
  CLICK_DATA: 'cd',

  /**
   * Contains more structured data registered during the execution of
   * the jsaction handler and registered with the ActionFlow
   * instance. Among these data is informaiton about impressions that
   * were generated during the handling of the jsaction.
   */
  CLICK_ADDITIONAL_DATA: 'cad',

  /**
   * The event ID of the response that generated the clicked element,
   * as obtained from the value of the jstrack attribute.
   */
  EVENT_ID: 'ei',

  /**
   * The visual element data for the clicked element, as obtained from
   * the ved attribute.
   */
  VISUAL_ELEMENT_CLICK: 'ved',

  /**
   * The visual element type of the clicked element, as obtained from the vet
   * attribute.
   */
  VISUAL_ELEMENT_TYPE: 'vet'
};
