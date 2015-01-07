/**
 * @fileoverview Contains the generic interface for iterating over the dom path
 * an event has traveled. These generators are meant to be singletons so you
 * should not construct them yourself. You should use the static factory method
 * getGenerator instead.
 */
goog.provide('jsaction.domGenerator');
goog.provide('jsaction.domGenerator.Ancestors');
goog.provide('jsaction.domGenerator.EventPath');
goog.provide('jsaction.domGenerator.Generator');

goog.require('jsaction.Property');



/** @interface */
jsaction.domGenerator.Generator = function() {};


/**
 * @return {Element} The next element in the generator or null if none found.
 */
jsaction.domGenerator.Generator.prototype.next = function() {};



/**
 * Constructs a generator of all the ancestors of an element.
 * @constructor
 * @implements {jsaction.domGenerator.Generator}
 */
jsaction.domGenerator.Ancestors = function() {
  /** @private {Element} */
  this.node_ = null;

  /** @private {Element} */
  this.container_ = null;
};


/**
 * Resets an ancestors generator of an element with a new target and container.
 * @param {!Element} target the element to start walking ancestors at.
 * @param {!Element} container the element to stop walking ancestors at.
 * @return {!jsaction.domGenerator.Generator}
 * @private
 */
jsaction.domGenerator.Ancestors.prototype.reset_ =
    function(target, container) {
  this.node_ = target;
  this.container_ = container;
  return this;
};


/** @override */
jsaction.domGenerator.Ancestors.prototype.next = function() {
  // Walk to the parent node, unless the node has a different owner in
  // which case we walk to the owner.
  var curr = this.node_;
  if (this.node_ && this.node_ != this.container_) {
    this.node_ = this.node_[jsaction.Property.OWNER] || this.node_.parentNode;
  } else {
    this.node_ = null;
  }

  return curr;
};



/**
 * Constructs a generator of all elements in a path array.
 * Correctly handles jsaction.Property.OWNER on elements.
 * @constructor
 * @implements {jsaction.domGenerator.Generator}
 */
jsaction.domGenerator.EventPath = function() {
  /** @private {!Array.<!Element>} */
  this.path_ = [];

  /** @private {number} */
  this.idx_ = 0;

  /** @private {Element} */
  this.container_ = null;

  /** @private {boolean} */
  this.usingAncestors_ = false;
};


/**
 * Resets an EventPath with a new path and container.
 * @param {!Array.<!Element>} path
 * @param {!Element} container
 * @return {!jsaction.domGenerator.Generator}
 * @private
 */
jsaction.domGenerator.EventPath.prototype.reset_ =
    function(path, container) {
  this.path_ = path;
  this.idx_ = 0;
  this.container_ = container;
  this.usingAncestors_ = false;
  return this;
};


/** @override */
jsaction.domGenerator.EventPath.prototype.next = function() {
  // TODO(user): If we could ban OWNERS for all users of event.path
  // then you could greatly simplify the code here.
  if (this.usingAncestors_) {
    return jsaction.domGenerator.ancestors_.next();
  }
  if (this.idx_ != this.path_.length) {
    var curr = this.path_[this.idx_];
    this.idx_++;
    if (curr != this.container_) {
      // NOTE(user): The presence of the OWNER property indicates that
      // the user wants to override the browsers expected event path with
      // one of their own. The eventpath generator still needs to respect
      // the OWNER property since this is used by a lot of jsactions
      // consumers.
      if (curr && curr[jsaction.Property.OWNER]) {
        this.usingAncestors_ = true;
        jsaction.domGenerator.ancestors_.reset_(
            curr[jsaction.Property.OWNER],
            /** @type {!Element} */(this.container_));
      }
    }
    return curr;
  }
  return null;
};


/**
 * A reusable generator for dom ancestor walks.
 * @private {!jsaction.domGenerator.Ancestors}
 */
jsaction.domGenerator.ancestors_ =
    new jsaction.domGenerator.Ancestors();


/**
 * A reusable generator for dom ancestor walks.
 * @private {!jsaction.domGenerator.EventPath}
 */
jsaction.domGenerator.eventPath_ =
    new jsaction.domGenerator.EventPath();


/**
 * Return the correct dom generator for a given event.
 * @param {!Event} e the event.
 * @param {!Element} target the events target element.
 * @param {!Element} container the jsaction container.
 * @return {!jsaction.domGenerator.Generator}
 */
jsaction.domGenerator.getGenerator = function(e, target, container) {
  return e.path ? jsaction.domGenerator.eventPath_.reset_(e.path, container) :
      jsaction.domGenerator.ancestors_.reset_(target, container);
};
