import {Rx} from '@cycle/core';

// from cycle.js gitter channel

Rx.Observable.prototype.log = function(msg: string = "") {
  this.materialize().subscribe(notification => {
    var op = '';

    switch(notification.kind) {
      case 'N':
        op = 'onNext';
      break;
      case 'E':
        op = 'onError';
      break;
      case 'C':
        op = 'onCompleted';
      break;
      default:
        op = 'onNext';
    }
    console.log((msg ? msg + " => " : "") + op + '(%O)', notification.value);
  });
  return this;
};

// Logging and debugging function that subscribes to an observable
// and then logs the event.
Rx.Observable.prototype.debug = function(msg: string = null) {
    this.materialize().subscribe(notification => {

        let eventName = "";
        let eventValue;
        let logFn;

        switch(notification.kind) {
            case "N": 
                eventName = "onNext =>"
                eventValue = notification.value
                logFn = console.debug
                break;
            case "C":
                eventName = "onComplete"
                eventValue = ""
                logFn = console.debug
                break;
            case "E":
                eventName = "onError =>"
                eventValue = notification.exception
                logFn = console.error
                break;
        }

        logFn.bind(console)((msg ? msg + "\t" : ""), eventName, eventValue);

    });

    return this;
};

/*
Rx.Observable.interval(1000).take(10).map(x => ({value: {
  x
}})).log("Interval").subscribe();
*/


Rx.Observable.prototype.between = function between(first, second) {
  return this.window(first, () => second).switch()
}

Rx.Observable.prototype.notBetween = function notBetween(first, second) {
  return Rx.Observable.merge(
    this.takeUntil(first),
    first.flatMapLatest(() => this.skipUntil(second))
  )
}

/*
function InputHook() {
  if (!(this instanceof InputHook)) {
    return new InputHook();
  }
}

InputHook.prototype.hook = function (node) {
  nextTick(function () {
    if (document.activeElement !== node) {
      node.focus();
    }
  });
};

*/
function InputHook( state) {
  this.focusInput = state.focusInput
  this.clearInput= state.clearInput
}

InputHook.prototype.hook = function hook(element) {
  if (this.focusInput) {
    element.focus()
  }
  if (this.clearInput ) {
    element.value = ""
  }
}


module.exports = { InputHook };
