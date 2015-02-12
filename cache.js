// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Implements both a per element cache of its jsaction mapping
 * and a global parse cache. The former avoids an attribute access per DOM node
 * and the the latter avoids parsing the same jsaction annotation twice. In
 * a typical application the same jsaction value would be used many times while
 * the overall number of different values should be relatively small.
 */


goog.provide('jsaction.Cache');


goog.require('jsaction.Property');


/**
 * Map from jsaction annotation to a parsed map from event name to action name.
 * @private @const {!Object<!Object<string, string>>}
 */
jsaction.Cache.parseCache_ = {};



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
 * Looks up the parsed action map from the source jsaction attribute value.
 *
 * @param {string} text Unparsed jsaction attribute value.
 * @return {!Object.<string, string>|undefined} Parsed jsaction attribute value,
 *      if already present in the cache.
 */
jsaction.Cache.getParsed = function(text) {
  return jsaction.Cache.parseCache_[text];
};


/**
 * Inserts the parse result for the given source jsaction value into the cache.
 *
 * @param {string} text Unparsed jsaction attribute value.
 * @param {!Object.<string, string>} parsed Attribute value parsed into the
 *   action map.
 */
jsaction.Cache.setParsed = function(text, parsed) {
  jsaction.Cache.parseCache_[text] = parsed;
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
