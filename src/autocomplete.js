import Cycle, {Rx} from '@cycle/core';
import {h, makeDOMDriver } from '@cycle/dom';
import {makeHTTPDriver} from '@cycle/http';
import {makeJSONPDriver} from '@cycle/jsonp';
import mergeObjects from 'lodash/object/assign'
import {InputHook} from './util.js';

import _ from 'lodash';
/*
 * The best way to start something is to start by creating a custom element
 * where the basic dom is rendered by returning
 * Rx.Observable.just(<div>...</div>) atleast that way, you can be sure that
 * the custom element is setup properly, then building the intent and model in
 * that order.
 */

const style={
  autocomplete: {
    width:"300px",
    margin:"0px",
  },
  ac_item: {
    backgroundColor: '#dddddd',
    marginRight:"3px",
    marginBottom:"3px",
    padding:"3px",
    borderRadius:"3px",
    border:"1px solid grey",
    display:"inline-block",
    backgroundImage: "linear-gradient(to bottom,#f4f4f4 20%,#f0f0f0 50%,#e8e8e8 52%,#eee 100%)",
  },
  ac_item_hi: {
    marginRight:"3px",
    marginBottom:"3px",
    padding:"3px",
    borderRadius:"3px",
    border:"1px solid grey",
    display:"inline-block",
    backgroundImage: "linear-gradient(to bottom,#CCCCCC 20%,#f0f0f0 50%,#e8e8e8 52%,#eee 100%)",
  },
  ac_suggestion_item: {
    padding:"3px",
    paddingLeft:"7px",
    borderTop:"1px solid grey",
    cursor:"pointer",
    margin:"0px",
  },
  ac_item_del: {
    marginLeft:"2px",
    padding:"3px",
    cursor:"pointer",
    fontSize:"0.75em",
  },
  ac_input: {
    margin:"3px",
    padding:"0px",
    border:"0px",
    outline:"0px",  // sets the focus border
  },
  ac_suggestion_container:{
    margin:"0px",
    borderTop:"0px",
    borderLeft:"1px",
    borderRight:"1px",
    borderBottom:"1px",
    borderStyle:"solid",
    borderColor: "grey",
    borderRadius:"0px 0px 5px 5px",
    position:"absolute",
    width:"300px", 
    backgroundColor:"white",
    maxHeight:"150px",
    overflow:"auto",
  },
  ac_items_container:{
    border:"1px solid grey",
    padding:"5px",
    marginBottom:"0px",
    backgroundImage: "linear-gradient(to bottom,#eee 1%,#fff 15%)",
  },

}

const WP_URL= 'https://en.wikipedia.org/w/api.php?action=query&list=search&utf8=&format=json&continue=&sroffset=0&srsearch='
//const WP_URL= 'https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search='
const networking = {
  processResponses(JSONP) {
    return JSONP.filter(res$ => res$.request.indexOf(WP_URL) === 0)
    .switch()
    .map(res => { return res.query.search.map( (t)=> { return {dataset:{text:t.title, snippet:t.snippet}} })})
    //.map(res => { return res[1].map( (t)=> { return {dataset:{text:t}} })})
  },
  generateRequests(searchQuery$) {
    return searchQuery$
    .debounce(500)
    .filter( (q) => {return q.length >1})
    .map(q => WP_URL + encodeURI(q))
  },
}


function mapEventTarget( ev) {
  return ev.target;
}

function intent(DOM) {
 
  const UP_KEYCODE = 38
  const DOWN_KEYCODE = 40
  const ENTER_KEYCODE = 13
  const TAB_KEYCODE = 9 

  const ac_input_keydown$= DOM.get('.ac_input', 'keydown')
  const ac_input_change$= DOM.get('.ac_input', 'input')
  const ac_input_blur$= DOM.get('.ac_input', 'blur')
  const ac_input_focus$= DOM.get('.ac_input', 'focus')

  const ac_item_del_click$ = DOM.get('.ac_item_del', 'click')
 
  const ac_items_container_mousedown$= DOM.get('.ac_items_container', 'mousedown')

  const ac_suggestion_click$ = DOM.get('.ac_suggestion_item', 'click')
  const ac_suggestion_hover$ = DOM.get('.ac_suggestion_item', 'mouseenter')
  const ac_suggestion_mousedown$ = DOM.get('.ac_suggestion_item', 'mousedown')
  const ac_suggestion_mouseup$ = DOM.get('.ac_suggestion_item', 'mouseup')


  const enterPressed$ = ac_input_keydown$.filter(({keyCode}) => keyCode === ENTER_KEYCODE)
  const tabPressed$ = ac_input_keydown$.filter(({keyCode}) => keyCode === TAB_KEYCODE)
  const clearField$ = ac_input_change$.filter(ev => ev.target.value.length === 0)
  const inputBlurToItem$ = ac_input_blur$.between(ac_suggestion_mousedown$, ac_suggestion_mouseup$).do( e => console.log("blur to item")  )
  const inputBlurToElsewhere$ = ac_input_blur$.notBetween(ac_suggestion_mousedown$, ac_suggestion_mouseup$)
  const itemMouseClick$ = ac_suggestion_mousedown$.flatMapLatest(mousedown =>
    ac_suggestion_mouseup$.filter(mouseup => mousedown.target === mouseup.target)
  )

  const  search$ = ac_input_change$
  .debounce(500)
  .between(ac_input_focus$, ac_input_blur$)
  .map(ev => ev.target.value)
  .filter(query => query.length > 0)

  const moveHighlight$ = Rx.Observable
  .merge( 
         ac_input_keydown$.map(({keyCode}) => { switch (keyCode) {
           case UP_KEYCODE: return -1
           case DOWN_KEYCODE: return +1
           default: return 0
         }}),
         tabPressed$.map( ev=> 1)
        )
        .filter(delta => delta !== 0)

  const setHighlight$ = ac_suggestion_hover$ 
  .map(ev => ev.target.dataset.text)
  const keepFocusOnInput$ = Rx.Observable.merge(inputBlurToItem$, enterPressed$, tabPressed$, ac_items_container_mousedown$)
  const selectHighlighted$ = Rx.Observable.merge(itemMouseClick$, enterPressed$, tabPressed$)
  const wantsSuggestions$ = Rx.Observable.merge(
    ac_input_focus$.map(() => true),
      ac_input_blur$.map(() => false)
  )
  const quitAutocomplete$ =Rx.Observable.merge(clearField$, inputBlurToElsewhere$)

  return {
    search$,
    moveHighlight$,
    setHighlight$,
    keepFocusOnInput$,
    enterPressed$,
    selectHighlighted$,
    wantsSuggestions$,
    quitAutocomplete$,
    ac_items_container_mousedown$,
    ac_input_keydown$: ac_input_keydown$.map( mapEventTarget ),
    ac_input_change$: ac_input_change$.map( (ev)=> ev.target.value),
    ac_input_blur$: ac_input_blur$.map( mapEventTarget ),
    ac_input_focus$: ac_input_focus$.map( mapEventTarget ),
    ac_item_del_click$: ac_item_del_click$.map( (ev)=> ev.target.parentElement ),
    ac_suggestion_click$: ac_suggestion_click$.map( mapEventTarget ),
  }
}


function mergeItemSuggestions( state ){
  state.items = _.uniq(state.items, (i)=> i.dataset.text )
  state.suggestions =state.suggestions.filter( (s)=>{
      for(let i=0; i< state.items.length;i++){
        if (state.items[i].dataset.text === s.dataset.text){
          return false;
        }
      }
      return true;
    })
  return state
}

function model( suggestions$, actions ) {
  const state$= Rx.Observable
  .merge(
    actions.ac_suggestion_click$.map( (t)=>{ return{ op:"add", dataset:t.dataset  }}),
    actions.enterPressed$.map( (t)=>{ return{ op:"hiadd" }}),
    actions.moveHighlight$.map( (t)=>{ return{ op:"himove", delta:t }}),
    actions.ac_item_del_click$.map( (t)=>{ return {op:"del", dataset:t.dataset  }}),
    suggestions$.map( (suggestions)=>{ return {op:"sug", suggestions  }}),
    actions.quitAutocomplete$.map( (ev)=>{ return {op:"sug", suggestions:[]  }}),
    actions.search$.map( (ev)=>{ return {op:"search"}}),
    actions.keepFocusOnInput$.map( (ev)=>{ return {op:"focus"}}),
    actions.enterPressed$.map( (ev)=>{ return {op:"clear"}})
  )
  .startWith({items:[],suggestions:[], highlight_idx:0,highlighted:null, focusInput:true, searching:false, clearInput:false })
  .scan( (state, t) => { 
    state.searching=false
    state.focusInput=false
    state.clearInput=false
    if (t.op === "focus"){
      state.focusInput=true;
      return state
    } else if (t.op ==="search"){
      state.searching=true
      state.suggestions=[]
      state.highlighted=state.highlight_idx=0
      return state
    } else if (t.op ==="add"){
      state.items.push({ dataset:t.dataset}) 
      state.suggestions=[]
      state.highlighted=state.highlight_idx=0
      return mergeItemSuggestions(state)
    } else if (t.op === "del") {
      const tmp_items = state.items.filter( (i)=>{
        return i.dataset.text !== t.dataset.text
      })
      state.items =tmp_items
      state.highlighted=null
      state.highlight_idx=0
      state.suggestions=[]
      return mergeItemSuggestions(state)
    } else if (t.op === "sug") {
      state.suggestions = t.suggestions
      state.highlighted=null
      state.highlight_idx=0
      return mergeItemSuggestions(state)
    } else if (t.op === "himove") {
      state.highlight_idx = state.highlight_idx +t.delta
      if (state.highlight_idx < 0) state.highlight_idx=0
      state.highlighted = state.suggestions[state.highlight_idx] 
      return state
    } else if (t.op === "hiadd") {
      state.clearInput=true
      if (state.highlight_idx > -1 && state.highlight_idx <state.suggestions.length){
        state.items.push(state.suggestions[state.highlight_idx]) 
        state.suggestions=[]
        state.highlighted=state.highlight_idx=0
      }
      return state
    }
    return state
  })


  return state$ 
}

function makeAcSelectedItem( { dataset} ){
  //console.log("dataset", dataset.text)
  return h(
    'span.ac_item', 
    {
      style: style.ac_item,
      dataset: dataset,
      key: dataset.text
    },
    [
      h('span.ac_item_text', dataset.text), 
      h('span.ac_item_del', {style:style.ac_item_del}, "⌫"), 
    ] 
  )
}

function makeAcItemsContainer( state ){
  const itemsEl = state.items.map( makeAcSelectedItem) ;
  itemsEl.push( h('input.ac_input', {style:style.ac_input, placeholder:"Type here...", "data-hook": new InputHook( state )  }) );
  return h(
    'div.ac_items_container', 
    {style:style.ac_items_container},
    itemsEl
  );
}

function makeAcSuggestionItem( { dataset} ){
  return h(
    'div.ac_suggestion_item', 
    {
      style: style.ac_suggestion_item, 
      key: dataset.text,
      dataset:dataset
    },
    dataset.text
  )
}

function makeAcSuggestionContainer( state  ){
  const stil = mergeObjects({
    display: (state.suggestions.length>0 ) ? null: "none" ,
    visibility: (state.suggestions.length>0 ) ? "visible": "hidden" ,
  },style.ac_suggestion_container)
  const itemsEl = state.suggestions.map( ( {dataset},idx  )=>{ 
    const stil = mergeObjects({ 
      backgroundColor: state.highlight_idx === idx ? "#cccccc": null,
      },style.ac_suggestion_item )
    return h(
      'div.ac_suggestion_item', 
      {
        style: stil,
        key: dataset.text,
        dataset:dataset
      },
      dataset.text
    )
  }) ;
  return h(
    'div.ac_suggestion_container', 
    {style:stil}, 
    itemsEl
  );
}

function preventedEvents(actions, state$) {
  return actions.keepFocusOnInput$
    .withLatestFrom(state$, (event, state) => {
      if (state.suggestions.length > 0
      && state.highlight_idx > 0 ) { //!== null) {
        return event
      } else {
        return null
      }
    })
    .filter(ev => ev !== null)
}

function autocomplete( {DOM, JSONP} ){
  const actions = intent(DOM);

  const init_val = "foo bar who what how now brown cow".split(" ").map( (t)=>{ return { dataset:{text:t} } } )

  let suggestions$ = networking.processResponses(JSONP)
  //const state$ = model( Rx.Observable.just(init_val), actions)
  const state$ = model( suggestions$, actions)
  const prevented$ = preventedEvents(actions, state$)
  return {
    JSONP: networking.generateRequests( actions.ac_input_change$.startWith("")),
    preventDefault: actions.keepFocusOnInput$,
    DOM: state$
    .map( (state) => {
      //console.log("state",  state)
      state = state || {items:[],suggestions:[], focus:false, searching:false}
      return h(
        'div.autocomplete', 
        {
          style:style.autocomplete
        },
        [
          makeAcItemsContainer( state ), 
          makeAcSuggestionContainer( state ),
          h('div.whatever',  state.searching? "..searching":""),
        ]
      )  
    })
  }
}

function preventDefaultSinkDriver(prevented$) {
  prevented$.subscribe(ev => {
    ev.preventDefault()
    if (ev.type === 'blur') {
      console.log("got blur")
      ev.target.focus()
    }
  })
}

let drivers = {
  DOM: makeDOMDriver('#app'),
  HTTP: makeHTTPDriver(),
  JSONP: makeJSONPDriver(),
  preventDefault: preventDefaultSinkDriver,
};

Cycle.run(autocomplete, drivers);

