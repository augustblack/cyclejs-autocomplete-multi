import Cycle from '@cycle/xstream-run';
import xs from 'xstream';
import debounce from 'xstream/extra/debounce'
import dropUntil from 'xstream/extra/dropUntil'
import isolate from '@cycle/isolate';
import {div, input, h1} from '@cycle/dom';
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


function reqMap({query,page} ){
  return function({urlMap, category}){
    return{
      url:urlMap({query,page}),
      category,
      progress:true
    }
  }
}

function defaultUrlMap({query,page} ){
  return `http://localhost:3000/word/${encodeURI(query)}?page=${page}`
}

function defaultProps( props=xs.of({}) ) {
  return props
  .map( p => {
    const tmp = {
      getPage : ( res ) => { return (res && res.body)? res.body.page : 0;},
      resFilter : ((res) => { return (res && res.body )}),
      SuggestionView : ({suggestion}) => (<span>{suggestion.text}</span>),
      SelectionView : ({selection}) => (<span>{selection.text}</span>),
      urlMap: defaultUrlMap,
      category:'ac',
      resMap : ( res ) => {
        const val= (res && res.body )?
        Object.assign({}, res.body, {results:res.body.results.map( r=> { return {id:r, text:r}})} )
        : {page:0,total:0, results:[] }
        return val
      },
    }
    return Object.assign({},tmp,p)
  })
}


const intent = ({HTTP}, props$ ) => {

  const httpSource$ = props$
  .map( ({category})=> {
    return HTTP
    .select( category )
    .map( (response$) =>{
      return response$
      .replaceError( (err) => {
        const e = { error: err.toString()}
        if (err.response && err.response.body){
          e.body = err.response.body
        }
        return xs.of(e)
      })
    })
    .flatten()
  })

  const info$ = httpSource$
  .flatten()
  .filter(ev => ev && (ev.error || ev.loaded || ev.percent) )
  .map( ev => {
    return printInfo(ev)
  })

  const httpResponse$ = httpSource$
  .flatten()
  .filter(ev => ev && !(ev.error || ev.loaded || ev.percent) )


  const	allSuggestions$ = xs.combine( httpResponse$, props$)
  .filter( ([res,props]) => props.resFilter(res) )

  const httpRespMap = ([res,props]) => props.resMap(res)
  const	suggestions$ =  allSuggestions$
  .filter( ([res,props]) => props.getPage(res) === 0 )
  .map( httpRespMap)

  const	moreSuggestions$ = allSuggestions$
  .filter( ([res,props]) => props.getPage(res) !== 0 )
  .map( httpRespMap)

  return {
    info$,
    suggestions$,
    moreSuggestions$,
  }
};

const printInfo = (p) =>{
  if (p.percent) {
    return `Loading ... ${p.percent}%`
  }
  else if (p.loaded && p.total > 0) {
    return `Loading ... ${parseInt(p.loaded/p.total*100)}%`
  }
  else if (p.loaded) {
    return `Loading ... ${p.loaded} bytes`
  }
  else if (p.error && p.body && p.body.message) {
    return p.body.message
  }
  else if (p.error) {
    return p.error
  }
  return null
}


const main =(sources) => {

  const props$ = defaultProps( sources.props )

  const actions = intent(sources, props$)

  const ac = autocomplete({
    DOM: sources.DOM,
    props: props$,
    actions
  })

  //networking requests
  const wantsMore$ = ac.value.wantsMore$
  .map( (wm )=> {
    return ac.value.state$
    .filter( ({suggestions, selections, total}) =>{
      if( (suggestions.length + selections.length) >= total)
        return false
      return true
    })
    .take(1)
    .map( (state) => {
      return {query: state.query, page:state.page+1}
    })
  })
  .flatten()

  const wantsSuggestions$ = ac.value.query$
  .filter( (query) => query.length >1 )
  .map( (query) =>{
    return {query, page:0}
  })

  const httpReq$ = xs.merge(wantsSuggestions$, wantsMore$)
  .map( ({query,page}) => props$.map( reqMap({query,page})))
  .flatten()

  return {
    DOM: ac.DOM,
    HTTP: httpReq$,
    value: ac.value.state$.map( s => s.selections),
  }
};

function isolateMain(sources){
  return isolate(main)(sources)
}
export default isolateMain

