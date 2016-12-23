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


const HTTP_CAT = 'ac'

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
function httpMap({query,page} ){
	return	{
		url: `http://localhost:3000/word/${encodeURI(query)}?page=${page}`,
		category: HTTP_CAT,
		progress:true,
	}
}


const intent = ({DOM, HTTP}) => {
	const UP_KEYCODE = 38
	const DOWN_KEYCODE = 40
	const ENTER_KEYCODE = 13
	const TAB_KEYCODE = 9
	const DELETE_KEYCODE = 46

	const acClick$ = DOM.select('.acContainer').events('click')

	const query$= DOM.select('.acInput').events('input')
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
	const inputBlurToSelected$ = inputBlur$.compose(between(selectedMouseDown$, selectedMouseUp$))
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

	const keepFocusOnInput$ = xs.merge(inputBlurToSuggestion$, enterPressed$, tabPressed$)
	const  selectHighlighted$ = xs.merge(suggestionMouseClick$, enterPressed$, tabPressed$)
	.compose(debounce(1))

  const  fetchSuggestions$ = xs.merge(
		inputFocus$.mapTo(true),
		inputBlur$.mapTo(false)
	)
  const quitAutocomplete$ = xs.merge(clearField$, inputBlurToElsewhere$)

	// networking Requests
	const	acReq$ =DOM.select('.acInput').events('input')
	.compose(debounce(300))//.compose(between(inputFocus$, inputBlur$))
	.map(ev => { return{query:ev.target.value, page:0}})
	.filter( ({query,page}) => query.length > 0)
	.map(httpMap)

	const	acMoreClickReq$ = DOM.select('.acSuggestionsMore').events('click')
	.map(ev => ev.target.data)
	.filter(({query,page}) => query.length > 0)
	.map(httpMap)

	// networking Responses
	const httpSource$ = HTTP.select(HTTP_CAT)
	const progress$ = httpSource$
	.flatten()
	.filter(ev => ev && (ev.loaded || ev.percent) )

	const	suggestions$ = httpSource$
	.flatten()
	.filter(res => res && res.body && res.body.results && res.body.page ===0 )
	.map( res=> res.body)

	const moreSuggestions$ = httpSource$
	.flatten()
	.filter(res => res && res.body && res.body.results && res.body.page !== 0 )
	.map( res=> res.body)


  return {
		//networking responses
		progress$,
		suggestions$,
		moreSuggestions$,

		//networking requests
		acReq$,
		//acMoreReq$,
		acMoreClickReq$,

		//UI
		query$,
    moveHighlight$,
    setHighlight$,
		selectedMouseClick$,
    keepFocusOnInput$,
    selectHighlighted$,
    fetchSuggestions$,
    quitAutocomplete$,
  }
};

function reducers(actions) {

	const resMap = (r) =>{
		return {id:r, full_name:r}
	}
	const uniqById = uniqWith(eqProps('id'))
	const mergeState= (state,newState)=> {
		return Object.assign({}, state, {selected:null, removed:null}, newState)
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

	const isFetchingReducer$ = xs.merge(actions.acReq$, actions.acMoreReq$, actions.acMoreClickReq$)
	.map( ()=> function setIsFetching(state) {
		return mergeState( state, { isFetching: true})
	})

	const suggestionReducer$ = actions.fetchSuggestions$
	.map(accepted => {
		return xs.merge(actions.suggestions$, actions.moreSuggestions$, actions.progress$)
		.map( json => function setSuggestions(state) {
			if (json && json.loaded) {
				return mergeState( state, {
					progress:	printProgress(json) ,
					suggestions: json.page === 0 ? [] : state.suggestions,
				})
			}
			else if( json && json.page === 0){
				const newSuggestions = cleanSuggestions({
					suggestions: json.results.map( resMap ),
					selections: state.selections,
				})
				return mergeState(state, {
					suggestions: newSuggestions,
					progress:null,
					isFetching:false,
					page:0,
					total:parseInt(json.total)
				})
			}
			else if( json && json.page !== 0){
				const newSuggestions = cleanSuggestions({
					suggestions: concat(state.suggestions, json.results.map(resMap )),
					selections: state.selections
				})
				return mergeState(state,  {
					suggestions: newSuggestions,
					isFetching: false,
					progress:null,
					page:json.page,
					total: parseInt(json.total)
				})
			}
		})
	})
	.flatten()


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
		return mergeState(state, {suggestions: [], total:0})
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
				suggestions: [],
				total:0,
			})
		}
		return state
	})

  return xs.merge(
		queryReducer$,
		isFetchingReducer$,
		suggestionReducer$,
    moveHighlightReducer$,
    setHighlightReducer$,
		selectedMouseClickReducer$,
		selectHighlightedReducer$,
    hideReducer$
  )
}

const model = ( actions) => {

	const reducer$ = reducers( actions )

	const state$ = reducer$
	.fold((acc, reducer) => reducer(acc), {
		query:"",
		suggestions:[],
		total:0,
		page:0,
		isFetching: false,
		progress:null,
		selected:null,
		selections:[],
		removed:null,
		highlighted:null
	})

	return state$
}

function AutoCompleteSelections({className,selections=[]}) {
  return (
    <ul className={className}>
    { selections
      .map( (s, index )=> <li
					 className={"acSelection"}
					 >
					 {s.full_name}
					 <span
           data={ Object.assign({}, s, {index} ) }
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
	progress,
}){
	if (progress !== null) {
		return `Loading... ${progress}`
	}
	if (total !== suggestions.length ) {
		return `${total - suggestions.length } more..`
	}
	return null
}

function AutoCompleteSuggestions ({
	className,
	progress,
	total,
	suggestions=[],
	highlighted,
}) {
	const info = AutoCompleteInfoLi({total,suggestions,progress})
  return (
    <ul className={className}>
    {  suggestions
			.map( (suggestion, index)=> <li
					 data={ Object.assign({},suggestion, {index}) }
					 index={index.toString()}
					 className={`${ suggestion.hide ? 'acSuggestionHide' : 'acSuggestion' } ${highlighted===index ? 'highlighted':''}`}
					 >{suggestion.full_name}</li>
					)
		}
		{ info? <li className={className+ "More"}>{info}</li>:""}
    </ul>
  )
}

const printProgress = (p) =>{
   if (p.loaded && p.total > 0) {
     return `${parseInt(p.loaded/p.total*100)}%`
   }
   else if (p.loaded) {
     return `Loading ..`
   }
   else {
     return ""
   }
}

const view = (state$) => {
  return state$
  .map( ({
		suggestions=[],
	 	total=0,
		selections=[],
		highlighted=null,
		selected=null,
		progress=null
	}) =>{
    return (
      <div className="acContainer">
      <AutoCompleteSelections
      className="acSelections"
      selections={ selections }
      />
      <input
			className="acInput"
			type="text"
			placeholder="Please type..."
			hook={ { update: (old,{elm})=>{ if (selected) { elm.value="", elm.focus()} } }}
			/>
      <AutoCompleteSuggestions
      className="acSuggestions"
			progress= {progress}
			total= {total}
      suggestions={ suggestions }
      highlighted={ highlighted}
      />
      </div>
    );
  })
}


function preventedEvents(actions, state$) {
	return state$
	.map(state =>
			 actions.keepFocusOnInput$.map(event => {
				 if (state.suggestions.length > 0
						 && state.highlighted !== null) {
							 return event
						 } else {
							 return null
						 }
			 })
			)
			.flatten()
			.filter(ev => ev !== null)
}

const main =(sources) => {
	const acMoreReqProxy$= xs.create();

  const actions = Object.assign(
    {},
		intent(sources),
		{acMoreReq$: acMoreReqProxy$}
	);

  const state$ = model(actions)

	const acMoreReq$ = state$
	.filter( state => {
		if (state.isFetching ||state.suggestions.length===0 || state.total === 0){
			return false
		}
		return (state.suggestions.length - state.highlighted  < 3)
	})
	.map( state=>{ return { page: state.page+1, query: state.query}})
	.map(httpMap)

	acMoreReqProxy$.imitate(acMoreReq$)

  const httpReq$ = xs.merge(actions.acReq$, actions.acMoreReq$, actions.acMoreClickReq$)

  const vtree$ = view(state$)
  return {
    DOM: vtree$,
    HTTP: httpReq$,
    value: state$.map( s => s.selections),
		preventDefault: preventedEvents(actions, state$)
  }
};

function isolateMain(sources){
  return isolate(main)(sources)
}
export default isolateMain

