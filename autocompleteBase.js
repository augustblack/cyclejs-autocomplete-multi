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


/**
 * source: --a--b----c----d---e-f--g----h---i--j-----
 * first:  -------F------------------F---------------
 * second: -----------------S-----------------S------
 *                         between
 * output: ----------c----d-------------h---i--------
 */
function between(first, second) {
  return (source) => first.mapTo(source.endWhen(second)).flatten()
}

/**
 * source: --a--b----c----d---e-f--g----h---i--j-----
 * first:  -------F------------------F---------------
 * second: -----------------S-----------------S------
 *                       notBetween
 * output: --a--b-------------e-f--g-----------j-----
 */
function notBetween(first, second) {
  return source => xs.merge(
    source.endWhen(first),
    first.map(() => source.compose(dropUntil(second))).flatten()
  )
}



export function intent ({DOM }, props$ ) {
  const UP_KEYCODE = 38
  const DOWN_KEYCODE = 40
  const ENTER_KEYCODE = 13
  const TAB_KEYCODE = 9
  const DELETE_KEYCODE = 46

  const query$= DOM.select('.acInput').events('input')
  .compose(debounce(300))//.compose(between(inputFocus$, inputBlur$))
  .filter( ev=> ev && ev.target )
  .map( ev => ev.target.value)

  const inputKeydown$ = DOM.select('.acInput').events('keydown')
  const inputFocus$ = DOM.select('.acInput').events('focus')
  const inputBlur$ = DOM.select('.acInput').events('blur')

  const suggestionHover$ = DOM.select('.acSuggestion').events('mouseenter')
  const suggestionMouseDown$ = DOM.select('.acSuggestion').events('mousedown')
  const suggestionMouseUp$ = DOM.select('.acSuggestion').events('mouseup')
  const suggestionMouseClick$ = suggestionMouseDown$
  .map(down => suggestionMouseUp$.filter(up => down.target === up.target))
  .flatten()

  const selectedMouseDown$ = DOM.select('.acSelection .delete').events('mousedown')
  const selectedMouseUp$ = DOM.select('.acSelection .delete').events('mouseup')
  const selectedMouseClick$ = selectedMouseDown$
  .map(down => selectedMouseUp$.filter(up => down.target === up.target))
  .flatten()

  const enterPressed$ = inputKeydown$.filter(({keyCode}) => keyCode === ENTER_KEYCODE)
  const tabPressed$ = inputKeydown$.filter(({keyCode}) => keyCode === TAB_KEYCODE)
  const deletePressed$ = inputKeydown$.filter(({keyCode}) => keyCode === DELETE_KEYCODE)
  const clearField$ = query$.filter( query => query.length === 0)

  const inputBlurToSuggestion$ = inputBlur$.compose(between(suggestionMouseDown$, suggestionMouseUp$))
  const inputBlurToElsewhere$ = inputBlur$.compose(notBetween(suggestionMouseDown$, suggestionMouseUp$))

  const moveHighlight$= inputKeydown$
  .map(({keyCode}) => {
    switch (keyCode) {
      case UP_KEYCODE: return -1
      case DOWN_KEYCODE: return +1
      default: return 0
    }
  })
  .filter(delta => delta !== 0)

  const setHighlight$=suggestionHover$
  .filter( ev => ev.target && ev.target.data )
  .map(ev => {
    return ev.target.data.index
  })

  const selectHighlighted$ = xs.merge(suggestionMouseClick$, enterPressed$, tabPressed$)
  .compose(debounce(1))

  const quitAutocomplete$ = xs.merge(clearField$, inputBlurToElsewhere$)

  const	wantsMore$=DOM.select('.acSuggestion:nth-last-child(-n+2)').events('mouseover')

  const acClick$= DOM.select('.acContainer').events('click')

  return {
    //UI
    acClick$,
    wantsMore$,
    query$,
    moveHighlight$,
    setHighlight$,
    selectedMouseClick$,
    selectHighlighted$,
    quitAutocomplete$,
  }
};

function reducers(actions) {

  const uniqById = uniqWith(eqProps('id'))
  const defaultState = {
    selected:null,
    setFocus:false,
    removed:null,
  }
  const mergeState= (state,newState)=> {
    return Object.assign({}, state, defaultState, newState)
  }

  function cleanSuggestions( {suggestions, selections} ) {
    return selections.length ?
      suggestions
      .filter( s => findIndex( propEq('id',s.id), selections ) === -1)
      : suggestions;
  }

  const queryReducer$ = actions.query$
  .map(  query => function setQuery(state) {
    const newState = mergeState( state, { query })
    return newState
  })

  const acClickReducer$ = actions.acClick$
  .map( () => function setFocus(state, props) {
    return mergeState( state, { setFocus:true } )
  })


  const infoReducer$ = actions.info$
  .map( info => function setInfo(state, props) {
    return mergeState( state, { info } )
  })

  const suggestionsReducer$ = actions.suggestions$
  .map( json => function setSuggestions(state, props) {
    const newSuggestions = cleanSuggestions({
      suggestions: json.results,  //.map( resMap ),
      selections: state.selections,
    })
    return mergeState(state, {
      suggestions: uniqById(newSuggestions),
      page:0,
      info: null,
      total:parseInt(json.total)
    })
  })

  const moreSuggestionsReducer$ = actions.moreSuggestions$
  .map( json => function setMoreSuggestions(state, props) {
    const newSuggestions = cleanSuggestions({
      suggestions: uniqById(concat(state.suggestions, json.results)), //.map(resMap )),
      selections: state.selections
    })
    return mergeState(state,  {
      suggestions: newSuggestions,
      page: state.page+1,
      info: null,
      total: parseInt(json.total)
    })
  })

  const moveHighlightReducer$ = actions.moveHighlight$
  .map(delta => function moveHighlightReducer(state) {
    const suggestions = state.suggestions
    const wrapAround = x => (x + suggestions.length) % suggestions.length
    if (state.highlighted === null) {
      return Object.assign({},state,{highlighted: wrapAround(Math.min(delta, 0))})
    } else {
      return Object.assign({},state,{highlighted:wrapAround(state.highlighted + delta)})
    }
  })

  const setHighlightReducer$ = actions.setHighlight$
  .map(highlighted => function setHighlightReducer(state) {
    return Object.assign({},state, {highlighted})
  })

  const hideReducer$ = actions.quitAutocomplete$
  .mapTo(function hideReducer(state) {
    return mergeState(state, {suggestions: [], total:0, info:null})
  })

  const selectHighlightedReducer$ = actions.selectHighlighted$
  .mapTo(xs.of(true, false))
  .flatten()
  .map(selected => function selectHighlightedReducer(state) {
    const hasHighlight = state.highlighted !== null
    const isMenuEmpty = state.suggestions.length === 0
    if (selected && hasHighlight && !isMenuEmpty) {
      const sel = state.suggestions[state.highlighted]
      return Object.assign({}, state, {
        selected: sel,
        setFocus: true,
        removed:null,
        selections : uniqById(append(sel, state.selections)),
        suggestions: [],
        total:0
      })
    }
    return state
  })

  const selectedMouseClickReducer$ = actions.selectedMouseClick$
  .map( ev => function selectedMouseClickReducer(state) {
    if (ev && ev.target && ev.target.data) {
      const	removed = Object.assign({}, ev.target.data);
      return Object.assign({}, state,{
        removed,
        selections : state.selections.filter( s=> s.id !== removed.id),
          selected:null,
          setFocus: true,
          suggestions: [],
          total:0,
      })
    }
    return state
  })

  return xs.merge(
    acClickReducer$,
    queryReducer$,
    infoReducer$,
    suggestionsReducer$,
    moreSuggestionsReducer$,
    moveHighlightReducer$,
    setHighlightReducer$,
    selectedMouseClickReducer$,
    selectHighlightedReducer$,
    hideReducer$
  )
}

export function model ( actions ) {

  const reducer$ = reducers( actions )

  const state$ = reducer$
  .fold((acc, reducer) => reducer(acc), {
    query:"",
    suggestions:[],
    total:0,
    page:0,
    selected:null,
    setFocus:false,
    selections:[],
    removed:null,
    highlighted:null,
    info:null
  })

  return state$
}

function AutoCompleteSelections({
  className,
  selections=[],
  SelectionView
}) {
  return (
    <ul className={className}>
    { selections
      .map( (selection, index )=> <li
           className={"acSelection"}
           >
           <SelectionView selection={selection} />
           <span
           data={ Object.assign({}, selection, {index} ) }
           index={index.toString()}
           className={"delete"}
           >&#10006;</span></li>
          )}
          </ul>
  )
}

function AutoCompleteInfoLi ({
  total,
  suggestions,
  selections,
  info,
}){
  const have = (suggestions.length + selections.length)
  if (info !== null) {
    return `info: ${info}`
  }
  if (total > 0 && total > have ) {
    return `${total - have} more..`
  }
  return null
}

function AutoCompleteSuggestions ({
  className,
  info,
  total,
  suggestions=[],
  selections=[],
  highlighted,
  SuggestionView
}) {
  const infoEl = AutoCompleteInfoLi({total,suggestions,selections,info})
  return (
    <ul className={className} style={suggestions.length ? {zIndex:100}: { display:"none", visibility:"hidden"}} >
    {  suggestions
      .map( (suggestion, index)=> <li
           data={ Object.assign({},suggestion, {index}) }
           index={index.toString()}
           className={`acSuggestion ${highlighted===index ? 'highlighted':''}`}
           ><SuggestionView suggestion={suggestion} /></li>
          )
    }
    { infoEl? <li className={className+ "More"}>{infoEl}</li>:""}
    </ul>
  )
}

export function view (state$, props$) {
  return xs.combine(state$, props$)
  .map( ([{
    suggestions=[],
    total=0,
    selections=[],
    highlighted=null,
    selected=null,
    setFocus=false,
    info=null
  },{
    SuggestionView,
    SelectionView
  }]) =>{
    return (
      <div className="acContainer">
      <AutoCompleteSelections
      className="acSelections"
      selections={ selections }
      SelectionView={ SelectionView }
      />
      <input
      className="acInput"
      type="text"
      placeholder="Please type..."
      hook={ { update: (old,{elm})=>{ if (setFocus) { elm.value= (selected ? "": elm.value), elm.focus()} } }}
      />
      <AutoCompleteSuggestions
      className="acSuggestions"
      info= {info}
      total= {total}
      suggestions={ suggestions }
      selections={ selections }
      highlighted={ highlighted}
      SuggestionView={SuggestionView}
      />
      </div>
    );
  })
}


const main =(sources) => {

  const props$ = sources.props

  const actions = intent(sources, props$)

  const state$ = model( merge(actions, sources.actions) )

  const vtree$ = view(state$, props$)

  return {
    DOM: vtree$,
    value: {
      wantsMore$:actions.wantsMore$,
      query$: actions.query$,
      state$
    }
  }
};

function isolateMain(sources){
  return isolate(main)(sources)
}
export default isolateMain

