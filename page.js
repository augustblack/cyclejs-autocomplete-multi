import Cycle from '@cycle/xstream-run';
import xs from 'xstream';
import {div, pre } from '@cycle/dom';
import {html} from 'snabbdom-jsx';
import Autocomplete from './autocomplete';


const model = (ac1$, ac2$) =>  {
  return xs.combine(ac1$, ac2$)
  .map( ([ac1,ac2]) => {
    return {ac1,ac2};
  });
}

const view = (state$, ac1DOM, ac2DOM) =>  {
  return xs.combine( state$,ac1DOM, ac2DOM)
  .map( ([state,ac1vtree, ac2vtree]) =>{
    return div([
      ac1vtree,
      ac2vtree,
      pre(JSON.stringify(state, null,2))
    ])
  })
}

const main = ( sources ) =>{
  const ac1 = Autocomplete(sources)
  const ac2 = Autocomplete(sources)

  const state$ = model(ac1.value, ac2.value)

  const vtree$ = view(state$, ac1.DOM, ac2.DOM)

  return {
    DOM: vtree$,
    value: state$,
    HTTP: xs.merge(ac1.HTTP, ac2.HTTP),
  }

}

export default main
