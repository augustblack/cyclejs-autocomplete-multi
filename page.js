import Cycle from '@cycle/xstream-run';
import xs from 'xstream';
import {div, pre } from '@cycle/dom';
import {html} from 'snabbdom-jsx';
import AutocompleteHttp from './autocompleteHttp';
import AutocompleteStatic from './autocompleteStatic';


const model = (ac1$, ac2$, ac3$) =>  {
  return xs.combine(ac1$, ac2$, ac3$)
  .map( ([ac1,ac2, ac3]) => {
    return {ac1,ac2, ac3};
  });
}

const view = (state$, ac1DOM, ac2DOM, ac3DOM) =>  {
  return xs.combine( state$,ac1DOM, ac2DOM, ac3DOM)
  .map( ([state, ac1vtree, ac2vtree, ac3vtree]) =>{
    return div([
      ac1vtree,
      ac2vtree,
      ac3vtree,
      pre(JSON.stringify(state, null,2))
    ])
  })
}

const main = ( sources ) =>{
  const ac1 = AutocompleteHttp(sources)
  const ac2 = AutocompleteHttp({ props:xs.of({
    urlMap: ({query,page})=>{
      return  `https://api.github.com/search/repositories?q=${encodeURI(query)}&page=${page}`
    },
    category:"github",
    resMap: (res) =>{
      const def = {total:0,page:0, results:[]}
      if (!(res && res.body && res.body.total_count)) {
        return def
      }
      const map = {
        total: res.body.total_count,
        page: 0,
        results: res.body.items.map( i=> {return {id:i.id, full_name:i.full_name }})
      }
      return Object.assign({},def,map)
    },
    getPage : ( res ) => {
     if( res && res.request && res.request.url){
       const reg= /page=(\d+)/
       const page= res.request.url.match(reg)[1]
       return parseInt(page)
     }
     return 0
    },
    SuggestionView : ({suggestion}) => (<span>{suggestion.full_name}</span>),
    SelectionView : ({selection}) => (<span>{selection.full_name}</span>),
  }), ...sources})

  const ac3 = AutocompleteStatic({ props:xs.of({
    suggestions: [
      {id:1, text:"hello"},
      {id:2, text:"blah"},
      {id:3, text:"blahblo"}
    ]
  }),
  ...sources })

  const state$ = model(ac1.value, ac2.value, ac3.value)

  const vtree$ = view(state$, ac1.DOM, ac2.DOM, ac3.DOM)

  return {
    DOM: vtree$,
    value: state$,
    HTTP: xs.merge(ac1.HTTP, ac2.HTTP)
  }

}

export default main
