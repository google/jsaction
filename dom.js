// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Functions that help jsaction interact with the DOM. We
 * deliberately don't use the closure equivalents here because we want
 * to exercise very tight control over the dependencies.
 */
goog.provide('jsaction.dom');


/**
 * Determines if one node is contained within another. Adapted from
 * {@see goog.dom.contains}.
 * @param {!Node} node Node that should contain otherNode.
 * @param {Node} otherNode Node being contained.
 * @return {boolean} True if otherNode is contained within node.
 */
jsaction.dom.contains = function(node, otherNode) {
  if (goog.isNull(otherNode)) {
    return false;
  }

  // We use browser specific methods for this if available since it is faster
  // that way.

  // IE DOM
  if ('contains' in node && otherNode.nodeType == 1) {
    return node.contains(otherNode);
  }

  // W3C DOM Level 3
  if ('compareDocumentPosition' in node) {
    return node == otherNode ||
        Boolean(node.compareDocumentPosition(otherNode) & 16);
  }

  // W3C DOM Level 1
  while (otherNode && node != otherNode) {
    otherNode = otherNode.parentNode;
  }
  return otherNode == node;
};
