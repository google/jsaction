# JsAction

JsAction is a tiny event delegation library that allows decoupling the DOM nodes
on which the action occurs from the JavaScript code that handles the action.

The traditional way of adding an event handler is to obtain a reference to the
node and add the event handler to it. JsAction allows us to map between events
and names of handlers for these events via a custom HTML attribute called
`jsaction`.

Separately, JavaScript code registers event handlers with given names which need
not be exposed globally. When an event occurs the name of the action is mapped
to the corresponding handler which is executed.

Finally, JsAction uncouples event handling from actual implementations. Thus one
may late load the implementations, while the app is always able to respond to
user actions marked up through JsAction. This can help in greatly reducing page
load time, in particular for server side rendered apps.

# Usage
## In the DOM
Actions are indicated with the `jsaction` attribute. They are separated by `;`,
where each one takes the form:

```
[eventType:]<namespace>.<actionName>
```

If an `eventType` is not specified, JsAction will assume `click`.

```html
<div id="foo"
     jsaction="leftNav.clickAction;dblclick:leftNav.doubleClickAction">
  some content here
</div>
```

## In JavaScript

### Set up

```js
var eventContract = new jsaction.EventContract;

// Register the event types we care about.
eventContract.addEvent('click');
eventContract.addEvent('dblclick');

var dispatcher = new jsaction.Dispatcher;

eventContract.dispatchTo(goog.bind(dispatcher.dispatch, dispatcher));
```

### Register individual handlers

```js
/**
 * Do stuff when actions happen.
 * @param {!jsaction.ActionFlow} flow Contains the data related to the action
 *     and more. See actionflow.js.
 *
 */
myapp.LeftNav.prototype.doStuff = function(flow) {
  // do stuff
};

myapp.LeftNav.prototype.registerHandlers = function() {
  dispatcher.registerHandlers(
      'leftNav',                       // the namespace
      this,                            // handler object
      {                                // action map
        'clickAction' : this.doStuff,
        'doubleClickAction' : this.doStuff
      });
};
```
