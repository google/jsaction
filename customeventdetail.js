goog.module('jsaction.CustomEventDetail');

/**
 * @record
 * @template T
 */
exports = class {
  constructor() {
    /** @type {string} */
    this.type;

    /** @type {T} */
    this.data;

    /** @type {!Event|undefined} */
    this.triggerEvent;
  }
};
