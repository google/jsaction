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

## Building

JsAction is built using the [Closure
Compiler](http://github.com/google/closure-compiler). You can obtain a recent
compiler from the site.

JsAction depends on the [Closure
Library](http://github.com/google/closure-library). You can obtain a copy of the
library from the GitHub repository.

The compiler is able to handle dependency ordering automatically with the
`--only_closure_dependencies` flag. It needs to be provided with the sources and
any entry points.

See the files dispatch_auto.js, eventcontract_auto.js, and
eventcontract_example.js for typical entry points.

Here is a typical command line for building JsAction's dispatch_auto.js:

<pre>
find path/to/closure-library path/to/jsaction -name "*.js" |
    xargs java -jar compiler.jar  \
    --output_wrapper="(function(){%output%})();" \
    --only_closure_dependencies \
    --closure_entry_point=jsaction.dispatcherAuto
</pre>

## Using drop-in scripts

If you would like to test out JsAction, you can link precompiled scripts into
your page.

```html

<script src="https://www.gstatic.com/jsaction/contract.js"></script>

...

<script src="https://www.gstatic.com/jsaction/dispatcher.js" async></script>
```

## Usage

You can play around with JsAction already set up with the following directions
at https://jsfiddle.net/q2eacgs7/.

## In the DOM

Actions are indicated with the `jsaction` attribute. They are separated by `;`,
where each one takes the form:

```
[eventType:]<namespace>.<actionName>
```

If an `eventType` is not specified, JsAction will assume `click`.

```html
<div id="container">
  <div id="foo"
       jsaction="leftNav.clickAction;dblclick:leftNav.doubleClickAction">
    some content here
  </div>
</div>
```

## In JavaScript

### Set up

```javascript
const eventContract = new jsaction.EventContract();

// Events will be handled for all elements under this container.
eventContract.addContainer(document.getElementById('container'));

// Register the event types we care about.
eventContract.addEvent('click');
eventContract.addEvent('dblclick');

const dispatcher = new jsaction.Dispatcher();
eventContract.dispatchTo(dispatcher.dispatch.bind(dispatcher));
```

### Register individual handlers

```javascript
/**
 * Do stuff when actions happen.
 * @param {!jsaction.ActionFlow} flow Contains the data related to the action
 *     and more. See actionflow.js.
 */
const doStuff = function(flow) {
  // do stuff
  alert('doStuff called!');
};

dispatcher.registerHandlers(
    'leftNav',                       // the namespace
    null,                            // handler object
    {                                // action map
      'clickAction' : doStuff,
      'doubleClickAction' : doStuff
    });
```

## Late loading the JsAction dispatcher and event handlers

JsAction splits the event contract and dispatcher into two separably loadable
binaries. This allows applications to load the small event contract early on the
page to capture events, and load the dispatcher and event handlers at a later
time. Since captured events are queued until the dispatcher loads, this pattern
can ensure that user events are not lost even if they happen before the primary
event handlers load.

Visit http://jsfiddle.net/880m0tpd/4/ to try out a working example.

### Load the contract early in the page

Just like in the regular example, in this example the event contract is loaded
very early on the page, ideally in the head of the page.

```html
<script id="contract" src="https://www.gstatic.com/jsaction/contract.js"></script>
<script>
  const eventContract = new jsaction.EventContract();

  // Events will be handled for all elements on the page.
  eventContract.addContainer(window.document.documentElement);

  // Register the event types handled by JsAction.
  eventContract.addEvent('click');
</script>

<button jsaction="button.handleEvent">
  click here to capture events
</button>
```

The event contract is configured to capture events for the entire page. Since
the dispatcher and event handlers are not loaded yet, the event contract will
just queue the events if the user tries to interact with the page. These events
can then be replayed after the dispatcher and event handlers are loaded, which
will be shown in this example next. This will ensure that no user interaction is
lost, even if it happens before the code is loaded.

### Loading the dispatcher and replaying events

At any point later in the page, the dispatcher and event handlers can be loaded
and any queued events can be replayed.

After the dispatcher and event handler code loads, you will configure the
dispatcher just like in the regular example:

```javascript
// This is the actual event handler code.
function handleEvent() {
  alert('event handled!');
}

// Initialize the dispatcher, register the handlers, and then replay the queued events.
const dispatcher = new jsaction.Dispatcher();
eventContract.dispatchTo(dispatcher.dispatch.bind(dispatcher));
dispatcher.registerHandlers(
    'button',
    null,
    { 'handleEvent': handleEvent });
```

There is some new code to replay the queued events:

```javascript
// This code replays the queued events. Applications can define custom replay
// strategies.
function replayEvents(events, jsActionDispatcher) {
  while (events.length) {
    jsActionDispatcher.dispatch(events.shift());
  }
}

// This will automatically trigger the event replayer to run if there are
// queued events.
dispatcher.setEventReplayer(replayEvents);
```

Now any events that happen during page load before the JS has loaded will be
replayed when the primary JS does load, ensuring that user interactions are not
lost.

## Common events to use with JsAction

This is a list of common events to listen to when configuring JsAction, although
it's not comprehensive.

```javascript
contract.addEvent('click');
contract.addEvent('dblclick');
contract.addEvent('focus');
contract.addEvent('blur');
contract.addEvent('keydown');
contract.addEvent('keyup');
contract.addEvent('keypress');
contract.addEvent('load');
contract.addEvent('mouseover');
contract.addEvent('mousein');
contract.addEvent('mouseout');
contract.addEvent('mouseleave');
contract.addEvent('submit');
contract.addEvent('touchstart');
contract.addEvent('touchend');
contract.addEvent('touchmove');
```
