import Cycle from '@cycle/xstream-run';
import xs from 'xstream';
import isolate from '@cycle/isolate';
import {html} from 'snabbdom-jsx';
import {
  eqProps,
  propEq,
  findIndex,
  intersectionWith,
  unionWith,
  merge,
  without,
  uniq,
  uniqWith,
  concat,
  append
} from 'ramda';

import autocomplete from './autocompleteBase';

function defaultProps( props=xs.of({}) ) {
  return props
  .map( p => {
    const tmp = {
      getPage : ( res ) => { return 0 },
      SuggestionView : ({suggestion}) => (<span>{suggestion.text}</span>),
      SelectionView : ({selection}) => (<span>{selection.text}</span>),
      suggestions: []
    }
    return Object.assign({},tmp,p)
  })
}

const main =(sources) => {

  const props$ = defaultProps( sources.props )

  const actions = {
    info$: xs.never(),
    moreSuggestions$: xs.never(),
    suggestions$: xs.create()
 }

  const ac = autocomplete({
    DOM: sources.DOM,
    props: props$,
    actions
  })

  const suggestions$ = ac.value.query$
  .map( (query)=> {
    return props$.map( ({suggestions}) =>{
      const reg= new RegExp(query, "i")
      return suggestions
      .filter( s => {
        return (s.text.match(reg) !== null)
      })
    })
    .map( suggestions =>{
      const uniqById = uniqWith(eqProps('id'))
      return {
        total: suggestions.length,
        page:0,
        results:uniqById(suggestions)
      }
    })
  })
  .flatten()
  actions.suggestions$.imitate(suggestions$)

  return {
    DOM: ac.DOM,
    value: ac.value.state$.map( s => s.selections),
  }
};

function isolateMain(sources){
  return isolate(main)(sources)
}
export default isolateMain

