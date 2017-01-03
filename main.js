import Cycle from '@cycle/xstream-run';
import xs from 'xstream';
import {makeHTTPDriver} from '@cycle/http';
import {makeDOMDriver} from '@cycle/dom';

import Page from './page';

Cycle.run(Page, {
  DOM: makeDOMDriver('#main-container'),
  HTTP: makeHTTPDriver(),
});
