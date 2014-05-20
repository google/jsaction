// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview A small library to share functions to get and set
 * jsaction parser cache entries.
 */


goog.provide('jsaction.Cache');


goog.require('jsaction.Property');



/**
 * Reads the jsaction parser cache from the given DOM Element.
 *
 * @param {!Element} element .
 * @return {!Object.<string, string>} Map from event to qualified name
 *     of the jsaction bound to it.
 */
jsaction.Cache.get = function(element) {
  return element[jsaction.Property.JSACTION];
};


/**
 * Writes the jsaction parser cache to the given DOM Element.
 *
 * @param {!Element} element .
 * @param {!Object.<string, string>} actionMap Map from event to
 *     qualified name of the jsaction bound to it.
 */
jsaction.Cache.set = function(element, actionMap) {
  element[jsaction.Property.JSACTION] = actionMap;
};


/**
 * Clears the jsaction parser cache from the given DOM Element.
 *
 * @param {!Element} element .
 */
jsaction.Cache.clear = function(element) {
  if (jsaction.Property.JSACTION in element) {
    delete element[jsaction.Property.JSACTION];
  }
};


/**
 * Reads the cached jsaction namespace from the given DOM
 * Element. Undefined means there is no cached value; null is a cached
 * jsnamespace attribute that's absent.
 *
 * @param {!Element} element .
 * @return {string|null|undefined} .
 */
jsaction.Cache.getNamespace = function(element) {
  return element[jsaction.Property.JSNAMESPACE];
};


/**
 * Writes the cached jsaction namespace to the given DOM Element. Null
 * represents a jsnamespace attribute that's absent.
 *
 * @param {!Element} element .
 * @param {?string} jsnamespace .
 */
jsaction.Cache.setNamespace = function(element, jsnamespace) {
  element[jsaction.Property.JSNAMESPACE] = jsnamespace;
};


/**
 * Clears the cached jsaction namespace from the given DOM Element.
 *
 * @param {!Element} element .
 */
jsaction.Cache.clearNamespace = function(element) {
  if (jsaction.Property.JSNAMESPACE in element) {
    delete element[jsaction.Property.JSNAMESPACE];
  }
};
