#! /usr/bin/env node
// -*- js -*-
// "use strict";
//
// openca-ng-cli.js
// 
// BASE SETUP
// =============================================================================

// Command Line Version
VERSION = "0.1.0";

var authPath = ".pkiSession";

// Context
const ctx = {};

// NPM Requires
const fs      = require("fs");
const req     = require('request');
const crypto  = require('crypto');

// Arguments
const prg = require('commander');

// Auth Value
var reqAuth = "";

// Setup the Cookies
if (fs.existsSync(authPath)) {
  reqAuth = fs.readFileSync(authPath, 'utf8', function(err, data) {
    console.log("ERROR: " + err);
    throw err;
  });
  reqAuth = reqAuth.replace(/(\r\n|\n|\r)/gm,"");
}

// General Vars
const host = "http://localhost:2560/1.0";

// Loads Conf and Engine
const OCAcnf = require("../conf/frontend/frontend-cnf");
const OCAEngine = require("../lib/common/engine.js")

// Exports Main Objects
OCAMsg    = OCAEngine.OCAMsg;
OCAErr    = OCAEngine.OCAErr;
OCAdebug  = OCAEngine.OCAdebug;
ApiError  = OCAEngine.ApiError;

// Some Information
banner();

// Let's Parse the arguments
prg.version(VERSION)
   .option('-l, --login', 'Logs in into an account and get the access token.')
   .option('-x, --logout', 'Invalidates the current access token and logs out.')
   .option('-a, --action <action>', 'Command (one of "add", "del", "mod", "list")')
   .option('-o, --org <organization>', 'Target Organization')
   .option('-t, --target <target>', 'Target to operate on (i.e., "org", "pki", "ca", "user", "job")')
   .option('-u, --username <username>', 'Login with the specified username')
   .option('-p, --password [password]', 'Password for logging into the system')
   .parse(process.argv);

// Check if Logout Procedure was selected
if (prg.logout) {

  // Checks we have an open session
  if (reqAuth == null || reqAuth == "") {
    console.error("\nERROR: No Sessions Open, Aborting.\n");
    return(1);
  }

  // Path for the API
  var path = host + "/u/logout";

  // request.post( path, { json: { } }, (err, res, body) => {
  OCAQuery( "post", path, { json: {} }, (msg, err, res) => {

    if (!msg) {
      OCAdebug("ERROR: Cannot logout (err: %s)", err);
      console.error(err);
      return;
    }

    // DEBUG
    console.dir(msg, 4, true);
  });

  return 0;
}

// Checks if we have an open Session, if not
// let the user know we need to login
if (reqAuth == null || reqAuth == "" ) {

  // Let's require the login option
  if (prg.login != true) {
    console.error("ERROR: Login required to start a new session (use -h for help)");
    process.exit(1);
  }
}

// Login Action
if (prg.login == true) {
// We need the credentials to start a new session
  if (prg.username == null || prg.password == null) {
    console.error("ERROR: No active session detected, please provide required credentials.");
    process.exit(1);
  }

  // Let's login and create a new session
  login(prg)
    .then( result => {
      console.log("Successfully Logged In (Session persisted on disk).");
      process.exit(0);
    })
    .catch( err => {
      var errMsg = new OCAMsg(err[0]);
      OCAdebug(JSON.stringify(errMsg.err()));
      // OCAdebug("ERROR: %s (%s)", errMsg.desc(), errMsg.errno());
      // console.dir(err, 4, true);
      process.exit(1);
    });

    // All Done
    return 0;
}

switch (prg.target) {

  case "usr" : {

    // Debugging
    OCAdebug("target '%s' selected.", prg.target);

    switch(prg.action) {

      case "get" : {
        OCAdebug("action '%s' selected", prg.action);
      } break;

      case "add" : {
        OCAdebug("action '%s' selected", prg.action);
      } break;

      case "del" : {
        OCAdebug("action '%s' selected", prg.action);
      } break;

      case "mod" : {
        OCAdebug("action '%s' selected", prg.action);
      } break;

      default: {
        throw new ApiError("ERROR: option '%s' not supported for $(prg.target) (must be one of 'login', 'logout', 'get', 'add', 'del', 'mod')", option);
      }
    }

  } break;

  // ORG Management
  case "org": {

    // Debugging
    OCAdebug("target '%s' prg.action selected.", prg.target);

    switch(prg.action) {

      case "get" : {
        OCAdebug("action '%s' selected", prg.action);
        var orgId = process.argv[4];
        var path = host + "/api/org/" + orgId;

        OCAQuery("get", path, null, (msg, err, res) => {

          // Error Checking
          if (!msg || msg.err() || err) {
            OCAdebug("ERROR: Cannot get info about ('%s')", orgId);
            console.error(err);
            return;
          }

          // Shortcut to the Organization Object
          var org = msg.body();

          // Prints out the info for the Organization
          OCAdebug("\n[ %s ('%s') Details ]", org.name + " - " + org.id);
        });

      } break;

      case "add" : {
        OCAdebug("action '%s' selected", prg.action);
      } break;

      case "del" : {
        OCAdebug("action '%s' selected", prg.action);
      } break;

      case "mod" : {
        OCAdebug("action '%s' selected", prg.action);
      } break;

      case "list" : {
        OCAdebug("action '%s' selected", prg.action);

        var path = host + "/api/org";

        OCAQuery("get", path, null, (msg, err, res) => {

          // Checks for some error
          if (!msg || err) {
            OCAdebug("ERROR: Cannot get the list of organizatios.", __function, __line);
            console.error(err);
            return;
          }

          // Shortcut to the Array of Organizations Objects
          var orgList = msg.body();
          var idx = 1;

          // Prints out the list
          console.log("\nList of Enabled Organizations:");
          console.log("==============================\n");
          for (i in orgList) {
            var org = orgList[i];
            if (typeof(org) !== "object") continue;
            console.log("[%d] %s [ id: %s ]\n    %s", 
              idx++, org.name, org.id, org.description);
          }
          console.log();
        });

      } break;

      default: {
        throw new ApiError("ERROR: action '%s' not supported for $(prg.target) (must be one of 'get', 'add', 'del', 'mod')", prg.action);
      }
    }

  } break;

  // PKI Management
  case "pki": {

    // Debugging
    OCAdebug("target '%s' action selected.", target);

    switch(prg.action) {

      case "get" : {
      } break;

      case "add" : {
      } break;

      case "del" : {
      } break;

      case "mod" : {
      } break;

      default: {
        throw new ApiError("ERROR: action '%s' not supported for $(prg.target) (must be one of 'add', 'del', 'mod')", prg.action);
      }
    }

  } break;

  // CA Management
  case "ca" : {

    // Debugging
    OCAdebug("target '%s' prg.action selected.", prg.target);

    switch(prg.action) {

      case "get" : {
      } break;

      case "add" : {
      } break;

      case "del" : {
      } break;

      case "mod" : {
      } break;

      default:
        throw new ApiError("ERROR: action ['" + prg.action + "'] not supported for $(prg.target) (must be one of 'get', 'add', 'del', 'mod')", prg.action);
    }

  } break;

  default: {
    throw new ApiError("ERROR: target ['" + prg.target + "'] is not supported (must be one of 'usr', 'org', 'pki', or 'ca').", prg.target);
  }
} 

// All Done
return 0;


/* login() - Login function */
function login(prg) {

  // const crypto = require("crypto");

  return new Promise ( (resolve, reject) => {

    var msg = null;

    OCAdebug("org '%s' selected", prg.org);
    OCAdebug("using '%s':'%s' as credentials.", prg.username, prg.password);

    if (prg.username == null || prg.password == null) {
      throw new Error("[%s():%s] Missing username ('%s') and/or password ('%s')",
        __function, __line, prg.username, prg.password);
    }

    try {

      const hmac = crypto.createHmac('sha256', prg.username);
      hmac.update(prg.password);
      const authCred = hmac.digest('base64');
    
      var data = {
        "uid" : prg.username,
        "org" : prg.org,
        "creds" : {
          "type" : "password",
          "value" : authCred
        }
      };

    } catch (err) {
      console.error("ERROR: " + err);
      console.dir(err, 4, true);
    }

    // Where to send the JSON
    var path = host + "/u/login/" + prg.org;

    OCAQuery("post", path, { json: data }, (msg, err, res) => {

      // Resolve or Reject depending on the result of the query
      if (msg.err() == null) resolve([ msg, res ]);
      else reject ([ msg, res ]);
    });

  });
}

function logout() {
  return new Promise (function OCA$login$Promise(resolve, reject) {

  });
}

// ==================
// Internal Functions
// ==================

function OCAQuery( method, url, options, callback ) {

  var __callback = callback;
  
  switch (method) {
    case "get":
    case "post" :
    case "head" :
      break;

    default:
      throw new Error("Method '%s' not supported", method);
  }

  // Make sure we have an options object
  if (options == null) {
    options = { };
  }

  // If a POST message, we need an OCAMsg
  if (method == "post" || method == "POST") {
    // If we have some JSON already,
    // let's use it in the msg body
    if (options.json != null) {
      // Generates a new OCAMsg object
      var reqMsg = new OCAMsg(options.json);
      // Sets the Auth Code for the Message
      reqMsg.auth(reqAuth);
      // Sets the JSON
      options.json = reqMsg.get();
    } else {
      // We need a new message
      var reqMsg = new OCAMsg();
      // Sets the Auth Code for the Message
      reqMsg.auth(reqAuth);
      // Sets the JSON
      options.json = reqMsg.get();
    }
  };

  OCAdebug("REQ => ['%s']", JSON.stringify(options.json));

  return req[method](url, options, (err, res, body) => {

    // Local Callback Variables
    var msg = null;
    var errMsg = null;

    // Builds the return message
    try {
      // In case of errors, let's return a JSON formatted
      // error message
      if (err) {
        errMsg = new OCAErr(500, "Error", err);
        errMsg.desc(err + "");
        msg = new OCAMsg(errMsg);
      } else {
        // Converts the body into an OCAMsg (if possible)
        if (typeof(body) === "undefined" || body == null) {
          msg = new OCAMsg();
        } else if (typeof(body) === "object" ) {
          msg = new OCAMsg(body);
  
        } else if (typeof(body) === "string" ) {
          try {
            msg = new OCAMsg(JSON.parse(body));
          } catch (e) {
            msg = new OCAMsg();
            msg.body(body);
          }
        }
      }
    } catch (e) {
      // Error while converting the returned data
      console.error("Error while generating OCAMsg");
      console.dir(e, 4, true);
    }

    OCAdebug("RESP => %s", JSON.stringify(msg.get()));
    OCAdebug("AUTH => %s", msg.auth());


    if (msg.auth() != null && msg.auth() != "") {

      // Saves the reqAuth value
      reqAuth = msg.auth();

      OCAdebug("REQ AUTH => %s", reqAuth);

      // Saves the data into the target user file
      fs.writeFileSync(authPath, reqAuth, function (err) {
        OCAdebug("authPath => %s", authPath);
        if (err) {
          console.error("ERROR: Cannot store auth token, aborting.");
          process.exit(1);
        }
      });

      OCAdebug("authPath => %s", authPath);
    }
    
    if (!msg) {
      errMsg = new OCAErr(666, "Internal Error", { "res" : res, "err" : err, "body" : body });
      msg = new OCAMsg(errMsg);
    }

    // Save the info into the context (ctx) global var
    ctx.err = err;
    ctx.res = res;
    ctx.msg = msg;

    return __callback(msg, err, res);
  });
}

function banner() {
  console.log("\nOpenCA EasyPKI API - v0.0.1");
  console.log("Copyright (C) 2019 by Massimiliano Pala and OpenCA Labs");
  console.log("All Rights Reserved\n");
}
