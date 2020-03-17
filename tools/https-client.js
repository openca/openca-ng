#! /usr/bin/env node
// -*- js -*-
// "use strict";
//
// openca-ng-cli.js
// 
// BASE SETUP
// =============================================================================

// Local Variables for the CLI
const VERSION  = "0.1.0";
const AUTHPATH = ".pkiSession";

// NPM Requires
const fs      = require("fs");
const tls     = require("tls");
const https   = require("https");
const crypto  = require("crypto");
const url     = require("url");

// Arguments
const prg = require('commander');

// General Vars
const host = "https://127.0.0.1:2561/1.0";

// Global: Load Main Config and Package Info
OCAcnf = require(__dirname + "/../conf/frontend/frontend-cnf");
if (OCAcnf == null) {
  OCAcnf = { };
}

// Internal Context Variable
const ctx = {};

// Loads Conf and Engine
OCAcnf.verbose = true;
OCAcnf.debug = true;

var OCAEngine = require("../lib/common/engine.js")

// Exports Main Objects
OCAMsg    = OCAEngine.OCAMsg;
OCAErr    = OCAEngine.OCAErr;
OCAdebug  = OCAEngine.OCAdebug;
OCAlog    = OCAEngine.OCAlog;
OCAquery  = OCAEngine.OCAquery;
ApiError  = OCAEngine.ApiError;

// Simplifying the TLS client auth initialization
TlsCryptoInit = OCAEngine.TlsCryptoInit;

// Some Information
banner();

// Let's Parse the arguments
prg.version(VERSION)
  .option('-l, --login <user>', "Logins with the provided ")
  .option('-s, --secret <password>', 'Password to use when logging in')
  .option('-u, --url <url>', 'URL to connect to (e.g., https://localhost:2561/1.0/).')
  .option('-m, --method <method>', 'HTTP method to use (e.g., "get", "delete", or "post")')
  .option('-p, --path <path>', 'Path to be added to the base URL (e.g., "o/status").')
  .option('-d, --data <data>', 'Data to send with the request (method will be "post").')
  .option('-k, --key <filename>', 'Client Private Key file (client auth).')
  .option('-c, --cert <filename>', 'Client Certificate file (client auth).')
  .option('-t, --trusted <filename>', 'Trusted Certificates file (to validate the server cert).')
  .option('-x, --xtest', 'Performs (the) "x"-tests against the frontend interface')
  .option('-z, --ztest', 'Performs (the) "z"-tests against the backend interface')
  .parse(process.argv);

// Initializes the Crypto Layer
var myOptions = TlsCryptoInit(OCAcnf.backend.clientAuth, 
  prg.key, prg.cert, prg.trusted);

// Options Variable
var myMsg = new OCAMsg();
var myMethod = "get";
var myPath = host;

// Gets the base url
if (prg.url != null && prg.url != "") {
  myPath = prg.url;
}

// Sets the default status
if (prg.path != null && prg.path != "") {
  myPath += "/" + prg.path;
} else {
  myPath += "o/status";
}

// Checks if we have data to send
if (prg.data != null && prg.data != "") {

  try {
    // Checks for the file existance
    if (!fs.existsSync(prg.data)) {
      OCAlog("\n[ERROR] Cannot open the data file ('%s'), aborting.", prg.data);
    }
    // Loads the data into the message body
    myMsg.body(fs.readFileSync(prg.data, 'utf-8'));
  } catch (e) {
    OCAdebug("\n[ERROR] Unexpected Exception (%s)", JSON.stringify(e));
    process.exit(1);
  }
  // Sets the Option's data to the one from the file
  myOptions.json = myMsg.get();
  // Sets the method to post
  myMethod = "post";
}

// Use the preferred method
if (prg.method != null && prg.method != "") {
  myMethod = prg.method;
}

// request.post( path, { json: { } }, (err, res, body) => {
OCAquery( myMethod, myPath, myOptions, myMsg.get(), null, (msg, res) => {

  // Checks for Network Errors
  if (msg.err() != null) {

    // Debugging Info
    OCAlog("=====BEGIN ERROR DATA=====");
    OCAlog("[ERR] %s [Code: %d]", 
      msg.err().desc(), msg.err().errno());
    if (msg.err().aux() != null) 
      OCAlog("[ERR] AUX: %s [Code: %d]", 
        msg.err().aux(), msg.err().errno());
    OCAlog("=====END ERROR DATA=====\n");

    // Exits the process
    process.exit(1);
  }

  // Do something with the data
  OCAlog("=====BEGIN MSG DATA=====");
  console.dir(msg.body());
  OCAlog("=====END MSG DATA=====\n");

});

return 0;

// ==================
// Internal Functions
// ==================

function banner() {
  console.log("\nOpenCA NG - CLI Query Tool - v0.0.1");
  console.log("Copyright (C) 2019-2020 by Massimiliano Pala and OpenCA Labs");
  console.log("All Rights Reserved\n");
}
