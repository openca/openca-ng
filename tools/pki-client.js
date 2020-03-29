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
const path    = require("path");
const https   = require("https");
const crypto  = require("crypto");
const url     = require("url");

// Arguments
const prg = require('commander');

// General Vars
const host = {
  "backend" : "https://127.0.0.1:8443/1.0",
  "frontend" : "https://127.0.0.1:6443/1.0"
};

// Default Credentials
const tlsConfigs = {
  "user1" : {
    "backend" : {
      "clientAuth" : {
        "trustedCas" : "conf/backend/pki.d/be-root/be-root-cert.pem"
      },
      "serverAuth": {
        "certName": "conf/frontend/pki.d/fe-server/fe-server-cert.pem",
        "subject": {
          "CN": "NG Backend Server 1"
        },
        "issuer": {
          "O": "OpenCA",
          "OU": "BackEnd Services",
          "CN": "Backend Infrastructure Root"
        },
        "issuerCertificate": {
          "subject": {
            "O": "OpenCA"
          },
          "issuer": {
            "O": "OpenCA",
            "OU": "BackEnd Services"
          }
        }
      }
    },
    "frontend" : {
      "clientAuth": {
        "trustedCas" : "conf/frontend/pki.d/fe-root/fe-root-cert.pem"
      },
      "serverAuth" : {}
    }
  },
  "user2" : {
    "backend" : {
      "clientAuth" : {
        "privKey" : "conf/frontend/pki.d/fe-beclient/fe-beclient-key.pem",
        "certAndChain" : "conf/frontend/pki.d/fe-beclient/fe-beclient-cert.pem",
        "trustedCas" : "conf/backend/pki.d/be-root/be-root-cert.pem"
      },
      "serverAuth" : {}
    },
    "frontend" : {
      "clientAuth" : {
        "privKey" : "conf/frontend/pki.d/fe-user/fe-user-key.pem",
        "certAndChain" : "conf/frontend/pki.d/fe-user/fe-user-cert.pem",
        "trustedCas" : "conf/frontend/pki.d/fe-root/fe-root-cert.pem"
      },
      "serverAuth" : {}
    }
  },
  "admin" : {
    "backend" : {
      "clientAuth" : {
        "trustedCas" : "conf/backend/pki.d/be-root/be-root-cert.pem"
      },
      "serverAuth" : {}
    },
    "frontend" : {
      "clientAuth" : {
        "trustedCas" : "conf/frontend/pki.d/fe-root/fe-root-cert.pem"
      },
      "serverAuth" : {}
    }
  },
  "global" : {
    "backend" : {
      "clientAuth" : {
        "trustedCas" : "conf/backend/pki.d/be-root/be-root-cert.pem"
       },
       "serverAuth" : {}
    },
    "frontend" : {
      "clientAuth" : {
        "trustedCas" : "conf/frontend/pki.d/fe-root/fe-root-cert.pem"
      },
      "serverAuth" : {}
    }
  }
};

const trustAnchors = {
  "frontend" : {
    "clientAuth" : {
      "trustedCas" : "conf/frontend/pki.d/fe-root/fe-root-cert.pem"
    },
    "serverAuth" : {},
  },
  "backend" : {
    "clientAuth" : {
      "trustedCas" : "conf/backend/pki.d/be-root/be-root-cert.pem"
    },
    "serverAuth" : {}
  }
};

// Internal Context Variable
const ctx = {};

// Global
OCAprg = "frontend";

// Authentication Token for HTTP requests
const authReq = loadAuthToken(AUTHPATH);

// Loads and exposes the Engine's Functionalities
var { OCAMsg, OCAErr, OCAdebug, OCAlog,
      OCAquery, OCAlogin, OCAlogout,
      ApiError, TlsCryptoInit } = require("../lib/common/engine.js");

// Some Information
banner();

// Let's Parse the arguments
prg.version(VERSION)
  .option('-u, --url <url>', 'URL to connect to (e.g., https://localhost:2561/1.0/).')
  .option('-f, --frontend', 'Frontend Auto Configuration')
  .option('-b, --backend', 'Backend Auto Configuration')
  .option('-x, --logout', 'Logs out of the existing session for the user.')
  .option('-l, --login', "Logins with the provided (tip: 'user' and 'org' are required)")
  .option('-u, --user <name>', 'Username or account identifier (e.g., user1)')
  .option('-o, --org <organization>', 'Organization to login into (e.g., "openca")')
  .option('-s, --secret <password>', 'Password to use when logging in')
  .option('-m, --method <method>', 'HTTP method to use (e.g., "get", "delete", or "post")')
  .option('-p, --path <path>', 'Path to be added to the base URL (e.g., "o/status").')
  .option('-d, --data <data>', 'Data to send with the request (method will be "post").')
  .option('-k, --key <filename>', 'Client Private Key file (client auth).')
  .option('-c, --cert <filename>', 'Client Certificate file (client auth).')
  .option('-t, --trusted <filename>', 'Trusted Certificates file (to validate the server cert).')
  .option('-v, --verbose', 'Increases the level of verbosity.')
  .option('-d, --debug', 'Provides debugging information.')
  .parse(process.argv);

// Checks for backend/frontend configuration
if (typeof prg.frontend !== "undefined") {
  OCAprg = "frontend";
} else if (typeof prg.backend !== "undefined") {
  OCAprg = "backend";
} else {
  OCAlog("    ERROR: One of '--frontend' or '--backend' is required, aborting.\n");
  process.exit(1);
}

// Global: Load Main Config and Package Info
const configFile = path.resolve(__dirname + "/../conf/" + OCAprg + "/" + OCAprg + "-cnf");
if ((OCAcnf = require(configFile)) == null) {
  OCAlog("    [ERROR] Cannot access config file ('%s'), aborting.", configFile);
  process.exit(1);
};

// Loads Conf and Engine
if (prg.verbose) OCAcnf.verbose = true;
if (prg.debug) OCAcnf.debug = true;

// Gets the default config (if any)
var defaultConfig = trustAnchors[OCAprg];

// Checks if we have a username
if (prg.user == null) {
  OCAdebug("    ERROR: Please provide the username or account identifier ('-u, --user <name>')\n");
  process.exit(1);
};

// User-Specific Defaults (if any)
defaultConfig = ( tlsConfigs[prg.user] != null ? tlsConfigs[prg.user][OCAprg] : defaultConfig );

// Initializes the Crypto Layer
var myOptions = TlsCryptoInit(defaultConfig, prg.key, prg.cert, prg.trusted);
myOptions.headers = {};

// Options Variable
var myMsg = new OCAMsg();
var myMethod = "get";
var myPath = host[OCAprg];

// Gets the base url
if (prg.url != null && prg.url != "") {
  myPath = prg.url;
}

// Sets the default status
if (prg.path != null && prg.path != "") {
  myPath += "/" + prg.path;
} else {
  myPath += "/o/status";
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

// Sets the Auth Token for the Request
myOptions.reqAuthPath = AUTHPATH;

// If we need to logout, let's do it
if (prg.logout) {
  // Builds the Login Options
  var logoutOptions = {
    "org"         : prg.org,
    "username"    : prg.user,
    "tlsOptions"  : myOptions
  };
  // We need to logout
  OCAlogout(host[OCAprg], logoutOptions, (msg, res) => {
    // Checks for errors
    if (msg.err() != null) {
      // Displays the returned message
      msgDisplay(msg, res);
      // Logs the failure
      OCAlog("Operation Failed.");
      // All Done
      process.exit(1);
    }
    // Provides the user with positive feedback
    OCAlog("Logout Successful.\n");
    // All Done.
    process.exit(0);
  })

  // All Done
  return 0;
}

// If we need to login, let's do that
if (prg.login) {
  // Builds the Login Options
  var loginOptions = {
    "org"         : prg.org,
    "username"    : prg.user,
    "tlsOptions"  : myOptions
  };
  // Sets the password (if provided)
  if (prg.secret != "") {
    loginOptions.password = prg.secret;
  }
  // Starts the Login Process
  OCAlogin(host[OCAprg], loginOptions, (msg, res) => {
    // Checks for errors
    if (msg.err() != null) {
      // Displays the returned message
      msgDisplay(msg, res);
      // Logs the failure
      OCAlog("Operation Failed.");
      // All Done
      process.exit(1);
    }
    OCAdebug(msg);
    // Provides the user with positive feedback
    OCAlog("Login Successful.\n");
  });

  // All Done
  return 0;
}

// Sends the Query and Process the Response
OCAquery(myMethod, myPath, myOptions, myMsg.get(), (msg, res) => {
  // Display the Message
  msgDisplay(msg, res);
  // All Done
  OCAlog("All Done.\n");
});

// All Done.
return 0;

// ==================
// Internal Functions
// ==================

function banner() {
  console.log("\nOpenCA NG - CLI Query Tool - v0.0.1");
  console.log("Copyright (C) 2019-2020 by Massimiliano Pala and OpenCA Labs");
  console.log("All Rights Reserved\n");
}

function loadAuthToken(fileName) {
  // Return Value
  var ret = undefined;
  // Setup the Cookies
  if (fs.existsSync(fileName)) {
    ret = fs.readFileSync(fileName, 'utf8')
            .replace(/(\r\n|\n|\r)/gm,"");
  }
  // All Done
  return ret;

}

function msgDisplay(msg, res, callback) {

  // Checks if we have good input
  if (msg != null) {

    // Checks for Network Errors
    if (msg.err() != null) {

      // Debugging Info
      OCAlog("[ERR] =====BEGIN ERROR DATA=====");
      OCAlog("%s [Code: %d]", 
        msg.err().desc(), msg.err().errno());
      if (msg.err().aux() != null) 
        OCAlog("[ERR] AUX: %s [Code: %d]", 
          msg.err().aux(), msg.err().errno());
      OCAlog("[ERR] =====END ERROR DATA=====\n");

      // Calls the callback
      if (typeof callback === "function") callback (msg, res);
      return;
    }

    // Do something with the data
    OCAlog("[MSG] =====BEGIN MSG DATA=====");
    console.dir(msg.body());
    OCAlog("[MSG] =====END MSG DATA=====\n");
  }

  // If a callback is provided, let's execute it
  if (typeof callback === "function") callback(msg, res);

  // All Done
  return;
}

/*
function OCAlogin(baseUrl, config, callback) {

  var retMsg = new OCAMsg();
  var errMsg = null;

  // Checks we have a good config object
  if (config == null) {
    retMsg.err(new OCAErr(500, "Missing required ('config') parameter."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }

  // Checks the Username requirement
  if (typeof config.username === "undefined") {
    retMsg.err(new OCAErr(500, "Missing required ('config.username') parameter."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }

  // Checks for the Organization requirement
  if (typeof config.org === "undefined") {
    retMsg.err(new OCAErr(500, "Missing required ('config.org') parameter."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }

  // Login Data
  var data = {
    "uid" : config.username,
    "org" : config.org
  };

  // Checks if we are using a secret or a public key
  if (config.password != null) {
    // Calculates the right password
    const hmac = crypto.createHmac('sha256', config.username)
                       .update(config.password)
                       .digest('base64');
    // Generates the Creds session
    data.creds = {
      "type" : "password",
      "value" : hmac
    };

  } else {
    // Generates an "empty" creds session
    data.creds = {
      "type" : "certificate"
    };
  }

  // Where to send the JSON
  var loginPath = baseUrl + "/u/login/" + config.org;

  OCAquery("post", loginPath, config.tlsOptions, data, callback);

  return;
}

*/
