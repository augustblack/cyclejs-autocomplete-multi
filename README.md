## Autocomplete with multi-select 

I extended the [cycle.js autocomplete example](https://github.com/cyclejs/cyclejs/tree/master/examples/autocomplete-search) to allow for multiple selections, each capable of being deleted.  I also component-ized the autocomplete in the example using ```isolate``` so that multiple autocompletes can run in parallel.  Besides handling progress and errors, this example also allows you to pass the autocomplete component props$ that tell it where to fetch data, and how to formulate the data for consumption and view.

This examples runs using two different services, a local word autocomplete server and a github api reques.

Get the [autocomplete-server](https://github.com/augustblack/autocomplete-server) going first. Then do:

```npm install```

Then :

```npm start```

This starts the webpack dev server. At this point you can open your browser to [http://localhost:8080](http://localhost:8080)

![image](https://cloud.githubusercontent.com/assets/1562570/21455686/9c3c2800-c8df-11e6-8c93-ee2b72b414ac.png)
