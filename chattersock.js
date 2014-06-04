/**
 * Module dependencies.
 */
var sys = require("sys");
var http = require("http");
var path = require("path");
var domain = require("domain");
var toobusy = require("toobusy-js");
var express = require("express");
var favicon = require("serve-favicon");
var bodyParser = require("body-parser");
var methodOverride = require("method-override");
var morgan = require("morgan");
var errorhandler = require("errorhandler");
var responseTime = require("response-time");
var async = require("async");
var sockjs = require("sockjs");

var app = express();

var routes = require("./routes");

var dmn = domain.create();

dmn.on("error", function(err) {
    console.log(err);
});

dmn.run(function() {

    if ("development" === app.get("env")) {
        // Gets called in the absence of NODE_ENV too!
        app.use(function (req, res, next) {
            // you always log
            console.error(" %s %s ", req.method, req.url);
            next();
        });
        app.use(morgan({ format: "dev", immediate: true }));
        app.use(errorhandler({ dumpExceptions: true, showStack: true }));
    }
    else if ("production" === app.get("env")) {
        app.use(errorhandler());
    }

    // all environments
    app.set("port", process.env.PORT || 8000);
    app.set("ip", process.env.IP || "0.0.0.0");

    app.use(function (req, res, next) {
        if (toobusy()) {
            res.send(503, "No chats for you! Come back - one year!!! Very busy right now, sorry.");
        } else {
            next();
        }
    });

    app.use(favicon(__dirname + "/public/chattersock.ico"));
    app.use(bodyParser());
    app.use(methodOverride());

    app.set("views", path.join(__dirname, "views"));
    app.set("view engine", "jade");
    app.use(express.static(path.join(__dirname, "public")));

    app.get("/", routes.index);

    app.use(function(err, req, res, next){
        console.error(err.stack);
        sys.puts("Caught exception: " + err);

        if (404 === err.status) {
            res.send(404, "** Only Bear Here :) **");
        }
        else {
            res.send(500, "Something broke!");
        }
    });
    // Add the responseTime middleware
    app.use(responseTime());
});

var messages = [];
var sockets = [];
var wsserver = sockjs.createServer();
wsserver.on("connection", function(socket) {
    // Send all messages to the new client
    messages.forEach(function (data) {
        socket.write(JSON.stringify(data));
    });

    // Add new socket to list
    sockets.push(socket);

    // Update roster
    updateRoster();

    socket.on("data", function(message) {
        var text = String(message || "");

        if (!text) {
          return;
        }

        console.log("MESSAGE:", text);

        try {
          var chatter = JSON.parse(text);
          if (chatter && chatter.name && 0 < chatter.name.length) {
            socket.chatter = chatter.name;

            // Update roster
            updateRoster();
          }
          else if (chatter && chatter.clear && 0 < chatter.clear.length) {
            // Clear massages
            messages.length = 0;

            socket.chatter = chatter.clear;

            // Update roster
            updateRoster();

            // Clear in clients
            broadcast(chatter);
          }
        }
        catch (err) {
          var msg = { name: socket.chatter, text: text };
          broadcast(msg);
          messages.push(msg);
        }
    });
    socket.on("close", function() {
      // Remove the socket from the list
      sockets.splice(sockets.indexOf(socket), 1);

      // Update roster
      updateRoster();
    });
});

function updateRoster() {
  async.map(
    sockets,
    function (socket, callback) {
      callback(null, socket.chatter);
    },
    function (err, names) {
      broadcast(names);
    }
  );
}

function broadcast(data) {
  sockets.forEach(function (socket) {
    socket.write(JSON.stringify(data));
  });
}

var server = http.createServer(app);
wsserver.installHandlers(server, { prefix: "/chattersock" });
server.listen(app.get("port"), app.get("ip"), function(){
    var addr = server.address();
    console.log("Express Server listening at", addr.address + ":" + addr.port);
});

process.on("uncaughtException", function (err) {
    console.error((new Date()).toUTCString() + " uncaughtException:", err.message);
    console.error(err.stack);

    sys.puts("Caught exception: " + err);
    process.exit(1);
});
