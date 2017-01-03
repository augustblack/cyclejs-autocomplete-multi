## Autocomplete with multi-select 

I extended the [cycle.js autocomplete example](https://github.com/cyclejs/cyclejs/tree/master/examples/autocomplete-search) to allow for multiple selections, each capable of being deleted.  I also component-ized the autocomplete in the example using ```isolate``` so that multiple autocompletes can run in parallel.  Besides handling progress and errors, this example also allows you to pass the autocomplete component props$ that tell it where to fetch data, and how to formulate the data for consumption and view.

This examples runs using two different services, a local word autocomplete server and a github api reques.

Get the [autocomplete-server](https://github.com/augustblack/autocomplete-server) going first. Then do:

```npm install```

Then :

```npm start```

This starts the webpack dev server. At this point you can open your browser to [http://localhost:8080](http://localhost:8080)

![image](https://cloud.githubusercontent.com/assets/1562570/21598814/5c645f56-d120-11e6-9084-9bd47fc6b4d8.png)
