/*
    This is the entry point to the server, where we only allow ES5 due to the fact that the Babel
    transpiler needs to be registered first and we can than kickoff things.
 */

require("babel/register");

// load the actual server
require("./app.js");
