import http from "http";
import util from "util";
import path from "path";

import express from "express";

import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'

const app = express();
const port=3000;
const server = http.createServer(app);
app.set("title", "C74 Packages");
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use(bodyParser.urlencoded({ extended: true, limit:'15mb' }));
app.use(bodyParser.json( {limit:'15mb'}))
app.use(cookieParser())

server.listen(port, function() {
    console.log(`started... on ${port}`)
});
