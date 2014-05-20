// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Functions that help jsaction interact with the DOM. We
 * deliberately don't use the closure equivalents here because we want
 * to exercise very tight control over the dependencies.
 */
goog.provide('jsaction.dom');


/**
 * Determines if one node is contained within another. Unlike goog.dom.contains,
 * this method returns false if node and otherNode are the same (which is the
 * native behavior of the contains method in the DOM spec).
 * @param {!Node} node Node that should contain otherNode.
 * @param {!Node} otherNode Node being contained.
 * @return {boolean} True if otherNode is contained within node.
 */
jsaction.dom.contains = function(node, otherNode) {
  if (node.contains) {
    return node.contains(otherNode);
  } else if (node.compareDocumentPosition) {
    return Boolean(node.compareDocumentPosition(otherNode) &
                   Node.DOCUMENT_POSITION_CONTAINED_BY);
  } else {
    while (otherNode.parentNode) {
      if (otherNode.parentNode == node) {
        return true;
      }
      otherNode = otherNode.parentNode;
    }
    return false;
  }
};
