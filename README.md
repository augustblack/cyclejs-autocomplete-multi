## Autocomplete with multi-select 

I extended the [cycle.js autocomplete example](https://github.com/cyclejs/cyclejs/tree/master/examples/autocomplete-search) to allow for multiple selections, each capable of being deleted.  I also component-ized the autocomplete in the example using ```isolate``` so that multiple autocompletes can run in parallel.

This examples runs using an autocomplete server [https://github.com/augustblack/autocomplete-server](https://github.com/augustblack/autocomplete-server)

Get the [autocomplete-server](https://github.com/augustblack/autocomplete-server) going first. Then do:

```npm install```

Then :

```npm start```

This starts the webpack dev server. At this point you can open your browser to [http://localhost:8080](http://localhost:3000)
