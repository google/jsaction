// Copyright 2008 Google Inc. All rights reserved.


goog.provide('jsaction.ActionFlow');
goog.provide('jsaction.ActionFlow.Event');
goog.provide('jsaction.ActionFlow.EventType');

goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('goog.object');
goog.require('goog.structs.Set');
goog.require('goog.style');
goog.require('jsaction.Attribute');
goog.require('jsaction.Branch');
goog.require('jsaction.Char');
goog.require('jsaction.Name');
goog.require('jsaction.Property');
goog.require('jsaction.Tick');
goog.require('jsaction.UrlParam');
goog.require('jsaction.event');



/**
 * Object wrapper around action flow that deals with overlapping action
 * flow instances and provides a nicer API than the procedural
 * API. The constructor implicitly records the start tick.
 *
 * @param {string} flowType For a ActionFlow that tracks a jsaction,
 *     this is the name of the jsaction, including the
 *     namespace. Otherwise it is whatever name the client application
 *     choses to track its actions by.
 * @param {Element} opt_node The node.
 * @param {Event} opt_event The event.
 * @param {number} opt_startTime The time at which the flow started,
 *     defaulting to the current time.
 * @constructor
 * @extends {goog.events.EventTarget}
 */
jsaction.ActionFlow = function(flowType, opt_node, opt_event, opt_startTime) {
  jsaction.ActionFlow.base(this, 'constructor');

  /**
   * The flow type. For an ActionFlow instance that tracks a jsaction,
   * this is the name of the jsaction including the jsnamespace. This
   * is cleaned so that CSI likes it as an action name. TODO(user):
   * However, this cleanup should be done at reporting time, and
   * actually by the report event handler that formats the CSI
   * request, not here.
   * @type {string}
   * @private
   */
  this.flowType_ = flowType.replace(jsaction.ActionFlow.FLOWNAME_CLEANUP_RE_,
      jsaction.ActionFlow.FLOWNAME_SAFE_CHAR_);

  /**
   * The flow type, without modification. Cf. flowType_, above.
   * @type {string}
   * @private
   */
  this.unobfuscatedFlowType_ = flowType;

  /**
   * The node at which the jsaction originated, if any.
   * @type {Element}
   * @private
   */
  this.node_ = opt_node || null;

  /**
   * The event which triggered the jsaction, or a copy thereof, if any.
   * @type {Event}
   * @private
   */
  this.event_ = opt_event ? jsaction.event.maybeCopyEvent(opt_event) : null;

  /**
   * The collection of timers, as an array of pairs of [name,value].
   * There are two interfaces for timers: tick() records a timer as
   * differences from start; intervalStart()/intervalEnd() records a
   * timer as time difference between arbitrary points in time after
   * start.  The array is kept sorted by the tick times.
   * @type {!Array.<!Array>}
   * @private
   */
  this.timers_ = [];

  /**
   * A map from tick name to tick time (in absolute time).
   * @type {!Object}
   * @private
   */
  this.ticks_ = {};

  /**
   * The start time, recorded in the constructor.
   * @type {number}
   * @private
   */
  this.start_ = opt_startTime || goog.now();

  /**
   * The maximum tick time in absolute time.
   * @type {number}
   * @private
   */
  this.maxTickTime_ = this.start_;

  /**
   * The opened branches and the number of times each branch was
   * opened (i.e. how many times should done() be called for each
   * particular branch).
   * We initialize the main branch as opened (as the constructor itself
   * is an implicit branch).
   * @type {!Object.<string, number>}
   * @private
   */
  this.branches_ = {};
  this.branches_[jsaction.Branch.MAIN] = 1;

  /**
   * The set of duplicate ticks. They are reported in extra data in the
   * jsaction.Name.DUP key.
   * @type {goog.structs.Set}
   * @private
   */
  this.duplicateTicks_ = new goog.structs.Set;

  /**
   * A flag that indicates that a report was sent for this
   * flow. Used for diagnosis of errors due to calls after the flow
   * has finished.
   * @type {boolean}
   * @private
   */
  this.reportSent_ = false;

  /**
   * Collects the data for jsaction tracking related to this ActionFlow
   * instance that are extraced from the DOM context of the
   * jsaction. Added by action().
   * @type {!Object}
   * @private
   */
  this.actionData_ = {};

  /**
   * Records the sampling rate for jsaction tracking related to this ActionFlow
   * instance, or zero if none was explicitly set with the 'jstrackrate'
   * attribute and the default sampling rate should be used for this request.
   * @type {number}
   * @private
   */
  this.actionCustomSamplingRate_ = 0;

  /**
   * Collects additional data to be reported after action is done.
   * The object contains string key-value pairs. Added by
   * addExtraData().
   * @type {!Object.<string, string>}
   * @private
   */
  this.extraData_ = {};

  /**
   * Collects the data for log impressions related to this ActionFlow
   * instance. Set by impression().
   * @type {!Object}
   * @private
   */
  this.impressionData_ = {};

  /**
   * Flag that indicates if the flow was abandoned. If it was, no report will
   * be sent when the flow completes.
   * @type {boolean}
   * @private
   */
  this.abandoned_ = false;

  // If event is a click (plain or modified), generically track the
  // action. Can possibly be extended to other event types.
  //
  // The handler of the action may modify the DOM context, which is
  // included in the tracking information. Hence, it's important to
  // track the action *before* the handler executes.
  //
  // The flow must be fully constructed before calling action(),
  // which relies at least on this.actionData_ being defined.
  if (jsaction.ActionFlow.ENABLE_GENERIC_EVENT_TRACKING && opt_event &&
        opt_node && opt_event['type'] == 'click') {
    this.action(opt_node);
  }

  // We store all pending flows to make it easier to find a hung
  // flow. This is effective only in debug.
  jsaction.ActionFlow.registerInstance_(this);

  if (goog.DEBUG) {
    /**
     * A unique identifier for this flow, for debugging purposes.
     * @type {number}
     * @private
     */
    this.id_ = ++jsaction.ActionFlow.nextId_;
  }
};
goog.inherits(jsaction.ActionFlow, goog.events.EventTarget);


/**
 * @define {boolean} Whether to do generic event tracking based on the
 *     'oi' attribute on action targets or their parent nodes.
 */
goog.define('jsaction.ActionFlow.ENABLE_GENERIC_EVENT_TRACKING', true);


/**
 * A registry of action flow instances. This makes it easy to find hung
 * ones.
 * @type {!Array.<!jsaction.ActionFlow>}
 */
jsaction.ActionFlow.instances = [];


/**
 * Registers a new instance in the instances registry.
 * @param {!jsaction.ActionFlow} instance The instance (of course, gjslint).
 * @private
 */
jsaction.ActionFlow.registerInstance_ = function(instance) {
  jsaction.ActionFlow.instances.push(instance);
};


/**
 * Removes an instance from the instances registry when it's
 * done.
 * @param {!jsaction.ActionFlow} instance The instance (of course, gjslint).
 * @private
 */
jsaction.ActionFlow.removeInstance_ = function(instance) {
  goog.array.remove(jsaction.ActionFlow.instances, instance);
};


/**
 * The dispatcher of the events that report about ActionFlow
 * instances. ActionFlow instances trigger events at the end of their
 * life for the application to handle, and e.g. send CSI and click
 * tracking reports. See jsaction.ActionFlow.Event for the event detail
 * data associated with such an event, and
 * jsaction.ActionFlow.EventType for the different events that are
 * fired.
 * @type {goog.events.EventTarget}
 */
jsaction.ActionFlow.report = new goog.events.EventTarget;


jsaction.ActionFlow.FLOWNAME_CLEANUP_RE_ = /[~.,?&-]/g;


/**
 * The character which we use to replace unsafe characters when
 * reporting to CSI.
 * @type {string}
 * @const
 * @private
 */
jsaction.ActionFlow.FLOWNAME_SAFE_CHAR_ = '_';


/**
 * The marker for the last processed output template element.
 * @type {string}
 * @const
 * @private
 */
jsaction.ActionFlow.TEMPLATE_LAST_OUTPUT_MARKER_ = '*';


/**
 * Errors reported by the action flow.
 * @enum {string}
 */
jsaction.ActionFlow.Error = {
  /**
   * Method action() was called after the flow finished.
   */
  ACTION: 'action',

  /**
   * Method branch() was called after the flow finished.
   */
  BRANCH: 'branch',

  /**
   * Method done() was called after the flow finished or on a branch
   * that was not pending.
   */
  DONE: 'done',

  /**
   * Method addExtraData() was called after the flow finished.
   */
  EXTRA_DATA: 'extradata',

  /**
   * Method impression() was called after the flow finished.
   */
  IMPRESSION: 'impression',

  /**
   * A tick was added on the flow after the flow finished.
   */
  TICK: 'tick'
};


if (goog.DEBUG) {
  /**
   * A counter used for generating unique identifiers.
   * @type {number}
   * @private
   */
  jsaction.ActionFlow.nextId_ = 0;


  /**
   * Specifies the flow type we want to show logging for. Only messages for this
   * flow will show up at the console.
   * @type {Array.<string>}
   */
  jsaction.ActionFlow.LOG_FOR_FLOW_TYPES = [/* e.g. 'application_link', '*' */];

  /**
   * Checks whether a particular value of flowType should be logged.
   * @param {string} flowType The value of the flowType.
   * @return {boolean} Whether we should log or not for this flow type.
   */
  jsaction.ActionFlow.shouldLog = function(flowType) {
    // This is very inefficient, but it's debug time, so that's okay and we
    // prefer shorter simpler code.
    for (var i = 0; i < jsaction.ActionFlow.LOG_FOR_FLOW_TYPES.length; i++) {
      var flow = jsaction.ActionFlow.LOG_FOR_FLOW_TYPES[i];
      if (flow == '*' || flowType.indexOf(flow) == 0) {
        return true;
      }
    }
    return false;
  };


  /**
   * A bit to flip to enable really verbose action flow logging or not.
   * @param {string} msg The message to log.
   * @private
   */
  jsaction.ActionFlow.prototype.log_ = function(msg) {
    if (jsaction.ActionFlow.shouldLog(this.flowType_)) {
      if (window.console) {
        window.console.log(this.flowType_ + '(' + this.id_ + '): ' + msg);
      }
    }
  };


  /**
   * Returns a unique flow identifier to be used for debugging purposes.
   * @return {number} The unique flow identifier.
   */
  jsaction.ActionFlow.prototype.id = function() {
    return this.id_;
  };
}


/**
 * Abandon this flow. No report will be sent when the flow completes.
 */
jsaction.ActionFlow.prototype.abandon = function() {
  this.abandoned_ = true;
};


/**
 * @return {number} The starting tick.
 */
jsaction.ActionFlow.prototype.getStartTick = function() {
  return this.start_;
};


/**
 * Returns the absolute value of a tick or undefined if the tick hasn't been
 * recorded.  Requesting the special 'start' tick returns the start timestamp.
 * If the tick was recorded multiple times the method will return the latest
 * value.
 * @param {string} name The name of the tick.
 * @return {number|undefined} The absolute value of the tick.
 */
jsaction.ActionFlow.prototype.getTick = function(name) {
  if (name == jsaction.Name.START) {
    return this.start_;
  }
  return this.ticks_[name];
};


/**
 * Returns a list of tick names for all ticks recorded in this ActionFlow.
 * May also include a 'start' name -- the 'start' tick contains the time
 * when the timer was created.
 * @return {Array} An array of tick names.
 */
jsaction.ActionFlow.prototype.getTickNames = function() {
  var tickNames = [];
  tickNames.push(jsaction.Name.START);

  for (var i = 0; i < this.timers_.length; ++i) {
    tickNames.push(this.timers_[i][0]);
  }

  return tickNames;
};


/**
 * Returns the largest tick time of all the ticks recorded so far.
 * @return {number} The max tick time in absolute time.
 */
jsaction.ActionFlow.prototype.getMaxTickTime = function() {
  return this.maxTickTime_;
};


/**
 * Adopts externally recorded action ticks. Must be invoked immediately
 * after constructor.
 *
 * @param {Object} timers The timers object is used as an associative
 *     container, where each attribute is a key/value pair of tick-label/
 *     tick-time. A tick labeled "start" is assumed to exist and will be
 *     used as the flow's start time.  All other ticks will be imported into
 *     the flow's timers. If the start tick is missing no ticks are adopted
 *     into the action flow.
 *
 * @param {Object.<string, number>=} opt_branches The names and counts for all
 *    the opened branches.
 */
jsaction.ActionFlow.prototype.adopt = function(timers, opt_branches) {
  if (!timers || !goog.isDef(timers[jsaction.Name.START])) {
    return;
  }
  this.start_ = timers[jsaction.Name.START];
  jsaction.ActionFlow.merge(this, timers);

  if (opt_branches) {
    // Method adopt() must be invoked immediately after the
    // constructor, so the only open branch will be the constructor
    // one. We can just copy the adopted branches over without
    // worrying that we'll overwrite.
    goog.object.forEach(opt_branches, goog.bind(function(count, branch) {
      this.branches_[branch] = count;
    }, this));
  }
};


/**
 * Checks if the ActionFlow instance is of a given type.
 * @param {string} type Flow type.
 * @return {boolean} Whether the type matches.
 */
jsaction.ActionFlow.prototype.isOfType = function(type) {
  return this.flowType_ == type.replace(
      jsaction.ActionFlow.FLOWNAME_CLEANUP_RE_,
      jsaction.ActionFlow.FLOWNAME_SAFE_CHAR_);
};


/**
 * Returns the type of the ActionFlow instance.
 * @return {string} Flow type.
 */
jsaction.ActionFlow.prototype.getType = function() {
  return this.flowType_;
};


/**
 * Sets the type of the ActionFlow instance. This can be used in cases where we
 * don't know the type of action at the time we create the ActionFlow, e.g. when
 * a second click produces a doubleclick action. This method should be used
 * sparingly, if at all.
 * @param {string} flowType The flow type.
 */
jsaction.ActionFlow.prototype.setType = function(flowType) {
  this.flowType_ = flowType.replace(jsaction.ActionFlow.FLOWNAME_CLEANUP_RE_,
      jsaction.ActionFlow.FLOWNAME_SAFE_CHAR_);
  this.unobfuscatedFlowType_ = flowType;
};


/**
 * Records one tick. The tick value is relative to the start tick that
 * was recorded in the constructor.
 * @param {string} name The name of the tick.
 * @param {Object=} opt_opts Options with the following optional fields:
 *     time: The timestamp, if it's not goog.now().
 *     doNotReportToServer: If true, do not report this tick to the
 *         server (e.g. csi or mfe).  The tick can still be used in puppet
 *         tests.
 *     doNotIncludeInMaxTime: If true, do not use this tick when calculating
 *         'max time' ticks, e.g. pdt, plt.
 */
jsaction.ActionFlow.prototype.tick = function(name, opt_opts) {
  if (this.reportSent_) {
    this.error_(jsaction.ActionFlow.Error.TICK, undefined, name);
  }

  opt_opts = opt_opts || {};

  if (goog.DEBUG && this.reportSent_) {
    this.log_(this.flowType_ + ': late tick ' + name);
  }

  // If we have already recorded this tick, note that.
  if (name in this.ticks_) {
    // The duplicate ticks will get reported in extra data in the dup key.
    this.duplicateTicks_.add(name);
  }

  var time = opt_opts.time || goog.now();
  if (!opt_opts.doNotReportToServer &&
      !opt_opts.doNotIncludeInMaxTime && time > this.maxTickTime_) {
    // Only ticks that are reported to the server should affect max tick time.
    this.maxTickTime_ = time;
  }

  var t = time - this.start_;
  var i = this.timers_.length;

  while (i > 0 && this.timers_[i - 1][1] > t) {
    i--;
  }

  goog.array.insertAt(this.timers_, [name, t, opt_opts.doNotReportToServer], i);
  this.ticks_[name] = time;
};


/**
 * Ends a linear, non-branched fragment of the flow of
 * control. Decrements the expect counter and sends report if there
 * are no more done() calls outstanding.
 *
 * Since the end of the flow is a time when you want to record a tick,
 * this also takes an optional tick name.
 *
 * @param {string} branch The name of the branch that ends. Closes the
 *    flow opened by the branch() call with the same name. The
 *    implicit branch in the constructor has a reserved name
 *    (jsaction.Branch.MAIN).
 * @param {string=} opt_tick Optional tick to record while we are at it.
 * @param {Object=} opt_tickOpts An options object for the tick.
 */
jsaction.ActionFlow.prototype.done = function(branch, opt_tick, opt_tickOpts) {
  if (this.reportSent_ || !this.branches_[branch]) {
    // Either the flow has finished or the branch is not pending.
    this.error_(jsaction.ActionFlow.Error.DONE, branch, opt_tick);
    return;
  }

  if (opt_tick) {
    this.tick(opt_tick, opt_tickOpts);
  }

  this.branches_[branch]--;

  if (this.branches_[branch] == 0) {
    // Branch is closed, remove it from the map.
    delete this.branches_[branch];
  }

  if (goog.DEBUG) {
    this.log_(' < done(' + branch + ':' + opt_tick + ')');
  }

  if (goog.object.isEmpty(this.branches_)) {
    if (goog.DEBUG) {
      this.log_('    = report time ' + branch + ':');
    }

    // Method report_() returns true if the DONE event was actually
    // fired. Then we can finalize the instance.
    if (this.report_()) {
      this.reportSent_ = true;
      this.finish_();
    }
  }
};


/**
 * Called when no more done() calls are outstanding and after the DONE
 * event was fired.
 * @private
 */
jsaction.ActionFlow.prototype.finish_ = function() {
  jsaction.ActionFlow.removeInstance_(this);
  this.node_ = null;
  this.event_ = null;
  this.dispose();
};


/**
 * Branches this flow, creating a subflow.  done() must be called on the
 * subflow.
 *
 * Branch announces an asynchronous operation, and that a done() call
 * will arrive asynchronously at some later time. This allows a
 * ActionFlow to account for multiple concurrent asynchronous
 * operations to finish in arbitrary order.
 *
 * Since the begin of an asynchronous operation is a time when you
 * want to record a tick, this also takes an optional tick name.
 *
 * @param {string} branch The name of the branch that is created. The
 *     corresponding done() should use the same name to signal that
 *     the branch has finished.
 * @param {string=} opt_tick Optional tick to record while we are at.
 * @param {Object=} opt_tickOpts Tick configuration object. See tick()
 *     for more details.
 */
jsaction.ActionFlow.prototype.branch =
    function(branch, opt_tick, opt_tickOpts) {
  if (this.reportSent_) {
    // Branch was called after the report was called. Trigger an error report.
    this.error_(jsaction.ActionFlow.Error.BRANCH, branch, opt_tick);
  }

  if (goog.DEBUG) {
    this.log_('> branch(' + branch + ':' + opt_tick + ')');
  }

  if (opt_tick) {
    this.tick(opt_tick, opt_tickOpts);
  }

  if (this.branches_[branch]) {
    this.branches_[branch]++;
  } else {
    this.branches_[branch] = 1;
  }
};


/**
 * Returns the current timers. Mostly for testing, but may become the
 * primary interface to obtain timers, and relegate reporting to a
 * library function.  Note that the array is sorted by tick times.
 * @return {!Array} Timers.
 */
jsaction.ActionFlow.prototype.timers = function() {
  return this.timers_;
};


/**
 * Returns the branchs registry. Mostly for testing.
 * @return {!Object} Branches.
 */
jsaction.ActionFlow.prototype.branches = function() {
  return this.branches_;
};


/**
 * First triggers a BEFOREDONE event on this ActionFlow instance. This
 * can be used for example to add additional ticks to a ActionFlow
 * instance right before sending the report, or even to create a fresh
 * branch, in which case the event handler must cancel the event.
 *
 * If the BEFOREDONE event was not cancelled, sends the DONE event on
 * the ActionFlow class. Usually this is handled by the reporting code
 * of the application, which sends one or more reports to the server.
 *
 * The Event instance is shared between BEFOREDONE and DONE.
 *
 * @return {boolean} Whether the flow is really done and can be
 *     disposed.
 * @private
 */
jsaction.ActionFlow.prototype.report_ = function() {
  if (this.abandoned_) {
    return true;
  }

  if (this.duplicateTicks_.getCount() > 0) {
    this.extraData_[jsaction.Name.DUP] =
        this.duplicateTicks_.getValues().join('|');
  }

  var event = new jsaction.ActionFlow.Event(
      jsaction.ActionFlow.EventType.BEFOREDONE, this);

  // BEFOREDONE fires on both the instance and the class.
  if (!this.dispatchEvent(event) ||
      !jsaction.ActionFlow.report.dispatchEvent(event)) {
    return false;
  }

  // Must come after the BEFOREDONE event fires because event handlers
  // can add additional data.
  var cad = jsaction.ActionFlow.foldCadObject_(this.extraData_);
  if (cad) {
    this.actionData_[jsaction.UrlParam.CLICK_ADDITIONAL_DATA] = cad;
  }

  event.type = jsaction.ActionFlow.EventType.DONE;
  return jsaction.ActionFlow.report.dispatchEvent(event);
};


/**
 * Triggers an error report if:
 * - data is added to the flow after it finished (e.g via tick(),
 *   addExtraData(), etc)
 * - branch/done are called after the flow finished
 * - done is called on a branch that is not open
 * The error report will contain the timing data of the flow and the current
 * opened branches. If the error was triggered by an incorrect branch/done call
 * the name of the branch is passed in and included in the report as well.
 *
 * @param {jsaction.ActionFlow.Error} error The type of error that
 *     triggered the report.
 * @param {string=} opt_branch If the error comes due to an incorrect
 *     call to branch/done, this is the name of the branch.
 * @param {string=} opt_tick If the call that triggered the error has a tick
 *     (i.e. tick()/branch()/done()) this is the name of the tick.
 * @private
 */
jsaction.ActionFlow.prototype.error_ = function(error, opt_branch, opt_tick) {
  var event = new jsaction.ActionFlow.Event(
      jsaction.ActionFlow.EventType.ERROR, this);
  event.error = error;
  event.branch = opt_branch;
  event.tick = opt_tick;
  event.finished = this.reportSent_;
  jsaction.ActionFlow.report.dispatchEvent(event);
};


/**
 * Folds a key-value data object into a string to be used as "cad"
 * URL parameter value. Keys and values are separated by colons, and
 * key-value pairs are separated by commas. Both keys and values
 * are escaped with encodeURIComponent to prevent them from having
 * unescaped separator characters. Empty data object will produce
 * empty string.
 *
 * Example:
 *   "key1:value1,key2:value2"
 *
 * @param {Object.<string, string>} object Data object containing of key-value
 *    pairs. Both key and value must be strings.
 * @return {string} The string representation of the object suitable
 *    for "cad" URL parameter value.
 * @private
 */
jsaction.ActionFlow.foldCadObject_ = function(object) {
  var cadArray = [];
  goog.object.forEach(object, function(value, key) {
    var escKey = encodeURIComponent(key);
    // Don't escape '|' to make it a practical character to use as a separator
    // within the value.
    var escValue = encodeURIComponent(value).replace(/%7C/g, '|');
    cadArray.push(escKey + jsaction.Char.CAD_KEY_VALUE_SEPARATOR + value);
  });

  return cadArray.join(jsaction.Char.CAD_SEPARATOR);
};


/**
 * Logs the tracking of jsactions, e.g. click event. It traverses the
 * DOM tree from the target element on which the action is initiated
 * upwards to the document.body, collects the values of the custom
 * attribute 'oi' attached on the nodes along the path, and then
 * concatenates them as a dotted string that is set to the URL
 * parameter 'oi' of the log request sent to MFE. When 'ved' custom
 * attribute is found in the DOM tree, it is set to the URL parameter
 * 'ved' of the log request.
 *
 * The log record will be created only if there is jstrack is
 * specified on the target element or up its DOM tree. If jstrack is
 * not "1", the value of jstrack is used as the log event ID.
 *
 * An example: for a DOM tree
 *   <div jstrack="1">
 *     ...
 *     <div oi="tag1">
 *       <div oi="tag2" jsaction="action2" jsinstance="x"></div>
 *     </div>
 *     ...
 *   </div>
 *
 * @param {Element} target The DOM element the action is acted on.
 */
jsaction.ActionFlow.prototype.action = function(target) {
  if (this.reportSent_) {
    this.error_(jsaction.ActionFlow.Error.ACTION);
  }

  var ois = [];
  var jsinstance = null;
  var jstrack = null;
  var ved = null;
  var vet = null;
  var jstrackrate = null;

  jsaction.ActionFlow.visitDomNodesUpwards_(target, function(element) {
    var oi = jsaction.ActionFlow.getOi_(element);
    if (oi) {
      ois.unshift(oi);
      // Find the 1st node with the jsinstance attribute.
      if (!jsinstance) {
        jsinstance = element.getAttribute(jsaction.Attribute.JSINSTANCE);
      }
    }
    // We should not try to find a ved outside of the scope of the EventId we
    // found. If jstrack is present and different from '1', it is assumed to be
    // an EventId. Imagine the following case:
    //
    // <div jstrack=eventid1 ved=ved1>
    //   <div jstrack=eventid2>
    //     <div ved=ved2>Imagine we do not touch this div.</div>
    //     <div jsaction=log.my_action>But we interact with this div.</div>
    //   </div>
    // </div>
    //
    // In that case, we would report (eventid2, ved1), which is wrong because
    // ved1 is relative to eventid1, not eventid2.
    // As soon as we have found eventid2, we should stop looking for a ved.
    if (!ved && (!jstrack || jstrack == '1')) {
      ved = element.getAttribute(jsaction.Attribute.VED);
    }
    if (!vet) {
      vet = element.getAttribute(jsaction.Attribute.VET);
    }
    if (!jstrack) {
      jstrack = element.getAttribute(jsaction.Attribute.JSTRACK);
    }
    if (!jstrackrate) {
      jstrackrate = element.getAttribute(jsaction.Attribute.JSTRACKRATE);
    }
  });

  if (vet) {
    this.actionData_[jsaction.UrlParam.VISUAL_ELEMENT_TYPE] = vet;
  }

  // Record no other action data if we found no jstrack.
  if (!jstrack) {
    return;
  }

  this.actionData_[jsaction.UrlParam.CLICK_TYPE] = this.flowType_;

  if (ois.length > 0) {
    this.addExtraData(
        jsaction.Attribute.OI,
        ois.join(jsaction.Char.OI_SEPARATOR));
  }

  if (jsinstance) {
    if (jsinstance.charAt(0) ==
        jsaction.ActionFlow.TEMPLATE_LAST_OUTPUT_MARKER_) {
      jsinstance = parseInt(jsinstance.substr(1), 10);
    } else {
      jsinstance = parseInt(/** @type {string} */(jsinstance), 10);
    }
    this.actionData_[jsaction.UrlParam.CLICK_DATA] = jsinstance;
  }

  if (jstrack != '1') {
    // Use jstrack as the log event ID.
    this.actionData_[jsaction.UrlParam.EVENT_ID] = jstrack;
  }

  // A ved parameter only makes sense if we found a corresponding EventId in the
  // DOM. However, we always put it in the ActionData, so that we can detect the
  // issue and report it.
  if (ved) {
    this.actionData_[jsaction.UrlParam.VISUAL_ELEMENT_CLICK] = ved;
  }

  if (jstrackrate) {
    this.actionCustomSamplingRate_ = parseInt(jstrackrate, 10);
  }
};


/**
 * Sets the event id action data field, if it is not already set.  This is
 * useful for ActionFlows that do not originate from a DOM tree that has a
 * specified event id.
 * @param {string} ei The event id.
 */
jsaction.ActionFlow.prototype.maybeSetEventId = function(ei) {
  if (!this.actionData_[jsaction.UrlParam.EVENT_ID]) {
    this.actionData_[jsaction.UrlParam.EVENT_ID] = ei;
  }
};


/**
 * Adds custom key-value pair to the action log record within
 * the cad parameter value.  When the log record
 * is sent, the pairs are converted to a string of the form:
 * "key1:value1,key2:value2,...".
 * The key-value pairs will be added to the cad parameter value
 * in no particular order.
 * @see jsaction.ActionFlow#foldCadObject_
 *
 * @param {string} key Key.
 * @param {string} value Value.
 */
jsaction.ActionFlow.prototype.addExtraData = function(key, value) {
  if (this.reportSent_) {
    this.error_(jsaction.ActionFlow.Error.EXTRA_DATA);
  }

  // Replace all deliminators ':', ':', and '," used by CAD with
  // underscores. Also replace white space with underscore.
  this.extraData_[key] = value.toString().replace(/[:;,\s]/g, '_');
};


/**
 * Gets the extra data as set by addExtraData().
 *
 * @return {Object!} The extra data object.
 */
jsaction.ActionFlow.prototype.getExtraData = function() {
  return this.extraData_;
};


/**
 * Gets the data collected by the call to action() from the
 * constructor.
 *
 * @return {Object!} The action data object.
 */
jsaction.ActionFlow.prototype.getActionData = function() {
  return this.actionData_;
};


/**
 * Gets the data collected by the call to impression().
 *
 * @return {Object!} The impression data object.
 */
jsaction.ActionFlow.prototype.getImpressionData = function() {
  return this.impressionData_;
};


/**
 * Collects impression data when a jstemplate is rendered. It
 * traverses the DOM tree rooted from the target node downwards,
 * aggregates the number of nodes with the same hierarchical
 * impression key, and appends them to the 'imp' parameter of the log
 * request sent to MFE.
 *
 * An example: for a DOM tree
 *   <div oi="tag1">
 *      <div oi="tag2" jsinstance="1"></div>
 *      <div oi="tag2" jsinstance="*2"></div>
 *   </div>
 *
 * when the template is rendered, the log request will be:
 * /maps/gen_204?imp=jsaction,tag1:1,tag1.tag2:2...
 *
 * @param {Element} target The DOM container element of the template.
 */
jsaction.ActionFlow.prototype.impression = function(target) {
  if (this.reportSent_) {
    this.error_(jsaction.ActionFlow.Error.IMPRESSION);
  }

  this.tick(jsaction.Tick.IMP0);

  var ois = [];
  if (target.parentNode) {
    jsaction.ActionFlow.visitDomNodesUpwards_(
        target.parentNode, function(element) {
          var oi = jsaction.ActionFlow.getOi_(element);
          if (oi) {
            ois.unshift(oi);
          }
        });
  }

  var oiCounters = this.impressionData_;

  /**
   * The callback to be called when visiting a node.
   *
   * @param {Element} node The DOM node to be visited.
   * @return {boolean} Whether some cleanup shall be done on calling
   *     context before leaving the node.
   */
  var enterFn = function(node) {
    var oi = jsaction.ActionFlow.getOi_(node);
    if (oi) {
      ois.push(oi);

      var fullOi = ois.join(jsaction.Char.OI_SEPARATOR);
      if (!oiCounters[fullOi]) {
        oiCounters[fullOi] = 0;
      }
      oiCounters[fullOi]++;
      return true;
    }
    return false;
  };

  /**
   * The callback to be called when leaving a node.
   */
  var leaveFn = function() {
    ois.pop();
  };

  jsaction.ActionFlow.visitDomNodesDownwards_(target, enterFn, leaveFn);

  this.tick(jsaction.Tick.IMP1);
};


/**
 * Checks whether the impression data whose tags match the given
 * pattern exist.
 *
 * @param {RegExp} pattern The regular expression to be matched with
 * impression tags.
 * @return {boolean} True if the impression data are not empty.
 */
jsaction.ActionFlow.prototype.hasImpression = function(pattern) {
  for (var tag in this.impressionData_) {
    if (tag.match(pattern)) {
      return true;
    }
  }
  return false;
};


/**
 * Traverses the DOM tree from the start node upwards, and invokes the
 * callback provided on each node visited. Stops at document.body.
 *
 * @param {Node} start The node the traversal starts from.
 * @param {function(!Element)} visitFn The callback to be invoked on each
 *     visited node.
 * @private
 */
jsaction.ActionFlow.visitDomNodesUpwards_ = function(start, visitFn) {
  for (var node = start; node && node.nodeType == goog.dom.NodeType.ELEMENT;
      node = node.parentNode) {
    visitFn(/** @type {!Element} */ (node));
  }
};


/**
 * Traverses the DOM tree from the start node downwards, and invokes
 * the callbacks provided when entering a node or leaving it.
 *
 * @param {Element} start The node the traversal starts from.
 * @param {Function} enterFn The callback to be invoked when visiting
 *     a node.
 * @param {Function} leaveFn The callback to be invoked when tracing
 *     back to the parent of a node. enterFn returns a boolean value that
 *     indicates whether leaveFn must be invoked or not.
 * @private
 */
jsaction.ActionFlow.visitDomNodesDownwards_ =
    function(start, enterFn, leaveFn) {
  if (!goog.dom.isElement(start) ||
      goog.style.getStyle(start, 'display') == 'none' ||
      goog.style.getStyle(start, 'visibility') == 'hidden') {
    // Hidden elements are not counted as impressions.
    return;
  }

  var postCallbackNeeded = enterFn(start);

  for (var node = start.firstChild; node; node = node.nextSibling) {
    jsaction.ActionFlow.visitDomNodesDownwards_(
        /** @type {Element} */(node),
        enterFn, leaveFn);
  }

  if (postCallbackNeeded) {
    leaveFn();
  }
};


/**
 * Returns the value of the attribute 'oi' attached to the designated node.
 *
 * @param {Element} node The DOM node to be checked.
 * @return {?string} The value of the attribute 'oi'.
 * @private
 */
jsaction.ActionFlow.getOi_ = function(node) {
  if (!node[jsaction.Property.OI] && node.getAttribute) {
    node[jsaction.Property.OI] = node.getAttribute(jsaction.Attribute.OI);
  }
  return node[jsaction.Property.OI];
};


/**
 * Calls tick on provided flow object if it is defined.
 *
 * @param {jsaction.ActionFlow|undefined} flow The jsaction.ActionFlow object.
 * @param {string} tick The tick name.
 * @param {number} opt_time The timestamp, if it's not goog.now().
 * @param {Object} opt_opts Options.  See ActionFlow.tick for details.
 */
jsaction.ActionFlow.tick = function(flow, tick, opt_time, opt_opts) {
  if (flow) {
    var opts = opt_opts || {};
    opts.time = opts.time || opt_time;
    // Technically we do not need to specify doNotReportToServer or
    // doNotIncludeMaxTime here since the default is false, but
    // jscompiler otherwise generates an error in tick() above about
    // the property being read but never set unless we set it
    // somewhere. So we set it here to silence that error.
    opts.doNotReportToServer = !!opts.doNotReportToServer;
    opts.doNotIncludeInMaxTime = !!opts.doNotIncludeInMaxTime;
    flow.tick(tick, opts);
  }
};


/**
 * Calls branch on provided flow object if it is defined.
 *
 * @param {jsaction.ActionFlow|undefined} flow The jsaction.ActionFlow object.
 * @param {string} branch The name of the branch that is created. The
 *    corresponding done() should use the same name to signal that the
 *    branch has finished.
 * @param {string} opt_tick The tick name.
 * @param {Object} opt_tickOpts The options for the tick.
 */
jsaction.ActionFlow.branch = function(flow, branch, opt_tick, opt_tickOpts) {
  if (flow) {
    flow.branch(branch, opt_tick, opt_tickOpts);
  }
};


/**
 * Calls done on provided flow object with optional tick if it is defined.
 *
 * @param {jsaction.ActionFlow|undefined} flow The jsaction.ActionFlow object.
 * @param {string} branch The name of the branch that ends. Closes the
 *    flow opened by the branch() call with the same name. The
 *    implicit branch in the constructor has a reserved name
 *    (jsaction.Branch.MAIN).
 * @param {string=} opt_tick The tick name.
 * @param {Object=} opt_tickOpts The options for the tick.
 */
jsaction.ActionFlow.done = function(flow, branch, opt_tick, opt_tickOpts) {
  if (flow) {
    flow.done(branch, opt_tick, opt_tickOpts);
  }
};


/**
 * Merges externally recorded flow ticks. The start time of the flow
 * is not changed ("start" tick is skipped.).
 *
 * @param {jsaction.ActionFlow} flow The ActionFlow to tick.
 * @param {Object} timers Timers as an associative container where each
 * attribute is a key/value pair of tick-label/ tick-time.  All other ticks
 * except "start" tick will be imported into the flow's timers.
 */
jsaction.ActionFlow.merge = function(flow, timers) {
  if (!timers) {
    return;
  }
  goog.object.forEach(timers, function(value, name) {
    if (name != jsaction.Name.START) {
      flow.tick(name, { time: value });
    }
  });
};


/**
 * Calls addExtraData on the given flow object if it is defined.
 *
 * @param {jsaction.ActionFlow|undefined} flow The jsaction.ActionFlow object.
 * @param {string} key The key to add.
 * @param {string} value The value for the given key.
 */
jsaction.ActionFlow.addExtraData = function(flow, key, value) {
  if (flow) {
    flow.addExtraData(key, value);
  }
};


/**
 * Returns the flow type of the jsaction for which this flow was created.
 * @return {string} The flow type.
 */
jsaction.ActionFlow.prototype.flowType = function() {
  return this.unobfuscatedFlowType_;
};


/**
 * Returns the namespace of the jsaction.
 * @return {string} The namespace. If the jsaction doesn't have a namespace,
 *     the empty string.
 */
jsaction.ActionFlow.prototype.actionNamespace = function() {
  var type = this.unobfuscatedFlowType_;
  return type.substr(0, type.indexOf(jsaction.Char.NAMESPACE_ACTION_SEPARATOR));
};


/**
 * Returns a actionflow tracked callback that will call the given function and
 * done() on the action flow. Calls branch() with the given branch name.  If
 * the optional ticks are supplied they will be called on branch() and done()
 * respectively.
 *
 * Example:
 * var myCallback = function() {
 * ...
 * };
 * ....
 * setTimeout(flow.callback(myCallback, 'branchfoo', 'tick0', 'tick1'), 0);
 *
 * @param {!Function} fn The callback that we want to track with the current
 *    actionflow.
 * @param {string} branchName The name of the branch to be opened before the
 *    callback is used. The branch will be closed when the tracked callback
 *    returned by this method is called.
 * @param {string=} opt_branchTick An optional tick to be called on branch.
 * @param {string=} opt_doneTick An optional tick to be called on done.
 * @return {!Function} The tracked callback.
 */
jsaction.ActionFlow.prototype.callback =
    function(fn, branchName, opt_branchTick, opt_doneTick) {
  this.branch(branchName, opt_branchTick);
  var flow = this;
  return function() {
    var ret = fn.apply(this, arguments);
    flow.done(branchName, opt_doneTick);
    return ret;
  };
};


/**
 * Returns the node associated with this jsaction.ActionFlow.
 *
 * When a jsaction.ActionFlow created, the node is always set. The node is set
 * to null when the ActionFlow report is sent and should not be accessed
 * after that.
 *
 * In opt, this returns null if the node is not set. In debug, we
 * fail immediately.
 *
 * @return {Element} The node.
 */
jsaction.ActionFlow.prototype.node = function() {
  return this.node_;
};


/**
 * Returns the event associated with this ActionFlow.
 *
 * When a jsaction.ActionFlow created, the event (copy) is always
 * set. The event is set to null when the ActionFlow report is sent and
 * should not be accessed after that.
 *
 * In opt, this returns null if the event is not set. In debug, we
 * fail immediately.
 *
 * @return {Event} The event.
 */
jsaction.ActionFlow.prototype.event = function() {
  return this.event_;
};


/**
 * Returns values of properties or attributes stored on the node or
 * undefined if the node is not set.
 * @param {string} key The name of the property or attribute being
 *     asked for.
 * @return {*} The value of the property or attribute.
 */
jsaction.ActionFlow.prototype.value = function(key) {
  var node = this.node_;
  return !node ? undefined :
      key in node ? node[key] :
      // HACK(user): The getAttribute check protects against gratuitous mocks.
      node.getAttribute ? node.getAttribute(key) : undefined;
};



/**
 * Event detail object for all the events defined above. This object
 * contains the action flow instance that fired it. It's not the event
 * target, because the ActionFlow instances fires their events on
 * ActionFlow.report, where the application can actually listen for
 * them.
 *
 * The event handlers can inquiry the source ActionFlow instance for
 * the actual details.
 *
 * @param {jsaction.ActionFlow.EventType} type The type of event.
 * @param {!jsaction.ActionFlow} flow The instance that fires this event.
 * @constructor
 * @extends {goog.events.Event}
 */
jsaction.ActionFlow.Event = function(type, flow) {
  goog.events.Event.call(this, type, flow);
  this.flow = flow;
};
goog.inherits(jsaction.ActionFlow.Event, goog.events.Event);


/**
 * The ActionFlow instance that fired this event. This is also set as
 * target, but as flow it's properly typed.
 * @type {!jsaction.ActionFlow}
 */
jsaction.ActionFlow.Event.prototype.flow;


/**
 * If type is ERROR, contains the error condition.
 * @type {(jsaction.ActionFlow.Error|undefined)}
 */
jsaction.ActionFlow.Event.prototype.error;


/**
 * If type is ERROR, optionally contains the branch where the error
 * condition occurred.
 * @type {(string|undefined)}
 */
jsaction.ActionFlow.Event.prototype.branch;


/**
 * If type is ERROR, optionally it contains the name of the tick that was being
 * recorded when the error occurred.
 * @type {(string|undefined)}
 */
jsaction.ActionFlow.Event.prototype.tick;


/**
 * If type is error, includes whether the flow had finished when the error
 * occurred.
 * @type {boolean}
 */
jsaction.ActionFlow.Event.prototype.finished;


/**
 * Events fired by ActionFlow instances.
 * @enum {string}
 */
jsaction.ActionFlow.EventType = {
  /**
   * Fired when the flow is done and before the DONE event is
   * fired. If a handler cancels the default action, then no DONE
   * event is fired, and the ActionFlow is not disposed of. This must
   * happen if a beforedone handler calls branch().
   */
  BEFOREDONE: 'beforedone',

  /**
   * Fired when the flow is done and no BEFOREDONE handler cancelled
   * the event.
   */
  DONE: 'done',

  /**
   * Fired whenever an error occurs. Can be handled even in production
   * to obtain error reports from deployed code. Specifically, it's
   * called when the following conditions ooccur:
   *
   * - branch/done/tick/addActionData/action/impression are called
   *   after the flow finished, or
   *
   * - done called on a branch that is not pending.
   */
  ERROR: 'error'
};
