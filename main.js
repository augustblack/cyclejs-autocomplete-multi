import Cycle from '@cycle/xstream-run';
import xs from 'xstream';
import {makeHTTPDriver} from '@cycle/http';
import {makeDOMDriver} from '@cycle/dom';

import Page from './page';

function preventDefaultSinkDriver(prevented$) {
  prevented$.addListener({
    next: ev => {
      ev.preventDefault()
      if (ev.type === 'blur') {
        ev.target.focus()
      }
    },
    error: () => {},
      complete: () => {},
  })
  return xs.empty()
}

Cycle.run(Page, {
  DOM: makeDOMDriver('#main-container'),
  HTTP: makeHTTPDriver(),
  preventDefault: preventDefaultSinkDriver,
});
