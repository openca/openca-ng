#! /usr/bin/env node
// =============================================================================
// OpenCA Next Generation Front End - v0.0.1
// (c) 2020 by Massimiliano Pala and OpenCA Labs
// All Rights Reserved
// =============================================================================

// Loads the Package Configuration
OCApkg = require(__dirname + "/package");

// Basic Requirements
const fs = require('fs');
const prg = require('commander');
const http = require('http');
const https = require('https');
const helmet = require('helmet');
const path = require('path');

// Front End Interface
OCAprg = null;

// Some Information
banner();

// Let's Parse the arguments
prg.version(OCApkg.version)
   .option('-f, --frontend', 'Runs the Front End (Client Facing) Server.')
   .option('-b, --backend', 'Runs the Back End (Order Processing) Server.')
   .option('-v, --verbose', 'Prints additional information while running.')
   .option('-d, --debug', 'Runs in debugging mode (lots of information).')
   .parse(process.argv);

// Let's Run in one of the two modes (frontend or backend)
if (prg.frontend == true && prg.backend == true) {
  console.error("ERROR: Only one of 'frontend' or 'backend' options allowed.\n");
  return(1);
}

// Sets the Frontend Prefix
if (prg.frontend == true) {
  OCAprg = "frontend";
}

// Sets the Backend Prefix
if (prg.backend == true) {
  OCAprg = "backend";
}

// Checks we have a prefix
if (OCAprg == null) {
  console.error("ERROR: One of '-frontend' (-f) or '-backend' (-b) options required.\n");
  return(1);
}

// Some Verbose Output
console.log("[=== Begin Server Initialization: ===]\n");
console.log("* Pre-Requisites Checking:");

// Global: Load Main Config and Package Info
OCAcnf = require(__dirname + "/conf/" + OCAprg + "/" + OCAprg + "-cnf");

// Sets the Verbose and Debug Option
if (prg.verbose == true) OCAcnf.verbose = true;
if (prg.debug == true) OCAcnf.debug = true;

// Global: Constant for OpenCA Base URL
BASE_URL = OCAcnf.baseUrl;

// Global: Generic URLs
Urls = OCAcnf.urls;

// Prepends the URLs with the baseUrl
for (i in Urls) {
  Urls[i] = OCAcnf.baseUrl + Urls[i];
}

// Global: Require Options
const reqOptions = {
  "recurse" : true,
  "extensions" : [ '.js', '.json' ], 
  "filter" : function (path) {
      return (path.match(/._.*/) ? false : true); }
  };

// Global: Common Modules
common = require("require-dir")( __dirname + "/lib/common", reqOptions);
console.log("  - Loaded common libraries .....: OK");

// Global: Library Modules
lib    = require("require-dir")( __dirname + "/lib/" + OCAprg, reqOptions);
console.log("  - Loaded local libraries ......: OK");

// Global: Modules Shortcut
// OCAsec   = lib.sec;
OCAtools  = common.tools;
OCAauth   = common.auth;
// OCAdata  = lib.data;

// Global: Engine Constructors
OCAMsg    = common.engine.OCAMsg;
OCAErr    = common.engine.OCAErr;

// Logging and Debugging
OCAlog    = common.engine.OCAlog;
OCAverb   = common.engine.OCAverb;
OCAdebug  = common.engine.OCAdebug;

// API Error
ApiError  = common.engine.ApiError

// Directories For Frontend
if (OCAprg == "frontend") {
OCApath = { 
    "base"   : path.normalize(__dirname),
    "data"   : path.normalize(__dirname + "/data/" + OCAprg),
    "audit"  : path.normalize(__dirname + "/data/" + OCAprg + "/audit.d"),
    "order"  : path.normalize(__dirname + "/data/" + OCAprg + "/order.d"),
    "type"   : path.normalize(__dirname + "/data/" + OCAprg + "/type.d"),
    "org"    : path.normalize(__dirname + "/data/" + OCAprg + "/org.d"),
    "pki"    : path.normalize(__dirname + "/data/" + OCAprg + "/pki.d"),
    "sync"   : path.normalize(__dirname + "/conf/" + OCAprg + "/sync.d"),
    "user"   : path.normalize(__dirname + "/conf/" + OCAprg + "/user.d"),
    "queue"  : path.normalize(__dirname + "/conf/" + OCAprg + "/bequeue.d")
  };
} else {
  // Directories For Backend
  OCApath = { 
    "base"  : path.normalize(__dirname),
    "data"  : path.normalize(__dirname + "/data/" + OCAprg),
    "ca"    : path.normalize(__dirname + "/data/" + OCAprg + "/ca.d"),
    "job"   : path.normalize(__dirname + "/data/" + OCAprg + "/job.d"),
    "audit" : path.normalize(__dirname + "/data/" + OCAprg + "/audit.d"),
    "order" : path.normalize(__dirname + "/data/" + OCAprg + "/order.d"),
    "type"  : path.normalize(__dirname + "/data/" + OCAprg + "/type.d"),
    "csp"   : path.normalize(__dirname + "/conf/" + OCAprg + "/csp.d"),
    "user"  : path.normalize(__dirname + "/conf/" + OCAprg + "/user.d"),
    "queue" : path.normalize(__dirname + "/conf/" + OCAprg + "/fequeue.d")
  };
}

// Synchronization and Offline Support
if (OCAprg == "frontend") {

  // This Global Object is used for managing the
  // synchronization between the Frontend and the
  // Backend (that can be online or offline)
  OCAbesync = lib.besync.OCAbesync;

  // This Global Object is used for Synchronizing
  // across different Frontends (e.g., users, orgs,
  // products, etc.)
  OCAfesync = lib.fesync.OCAfesync;

  // Synchronization Object for Frontends
  OCAlog('\n* Setting up Front-End Synchronization Objects (configs: %s)',
    OCApath.queue);

  OCAsync = {
    "backend" : new OCAbesync(OCApath.queue, null),
    "frontend" : new OCAfesync(OCApath.sync, { "localId" : OCAcnf.id })
  };

}

// Checks the existance of the required paths
for (var dir in OCApath) {
  // Checks if the directory still exists
  if (!fs.existsSync(OCApath[dir])) {
    // If we have a missing directory, we create it
    fs.mkdir(OCApath[dir], '0700', function $mail$createDirs (err) {
      // Checks if we have an error code
      if (err != null && err.code != 'EEXIST') {
        // Non recoverable error, we must abort.
        OCAdebug("ERROR: Cannot create dir [ id: %s, path: %s, err: %s]", OCApath[dir], OCApath[dir], err);
        process.exit(1);
      }
    })
  }
}

// Instantiate the Global Objects
if (OCAprg == "backend") {

  // Global Objects for Backends

  // Orders Submitted
  OCAorders = { 
    "queue" : { }
  }; // Frontend Orders

  // Jobs Created from Orders
  OCAjobs   = { 
    "queue" : { },
    "last" : null,
    "first" : null
  }; // Backend Jobs

  // Avaliable CAs (populated by init from ca.js)
  OCAcas = { 
    "queue" : { }
  }; // CA List

  // Availabe Crypto Service Providers (populated by ca.js)
  OCAcsps = {
    "queue" : { }
  }; // CSPs List

} else {

  // Global Objects for Frontends

  // Products Profiles
  OCAproducts  = { }; // Available Products

  // Available Organizations
  OCAorgs = {
    "queue" : { }
  };

  // Available PKIs
  OCApkis = {
    "queue" : { }
  };
}

// Make sure that all the needed paths are
// present in the directory structure
OCAlog("  - Checking local directories ..: OK");

// Start the Audit Facility
OCAaudit = { 
  "init" : common.audit.OCAaudit,
  "cnf" : OCAcnf.audit
}

// Setup the General Audit
OCAaudit.server  = new OCAaudit.init(OCApath.audit, OCAcnf.audit);

// Global: Session inactivity and lifetime (express in DB format)
SessionsConfig = {
  "maxInactivity" : OCAcnf.cookies.maxInactivity,
  "maxLifespan" : OCAcnf.cookies.maxLifespan,
  "cookieName"  : OCAcnf.cookies.name,
  "cookieDomain": OCAcnf.cookies.domain, // ".openca.org",
  "cookieMaxAge": OCAcnf.cookies.maxAge, // 1800000, // Expires in 30 mins
  "maxUpdateAge": OCAcnf.cookies.MaxUpdateAge, // 3600000  // Expires in 1 hour
};

// Some Verbose Output
OCAlog("\n* Netowork Server Initialization (Mode: %s):", OCAprg);

// Initializes the Auth Layer
OCAauth.init();

// Local: Packages
var Express      = require('express');        // call express
var BodyParser   = require('body-parser');
var CookieParser = require('cookie-parser');

// Promise Engine
Promise          = require('bluebird');

// define our app using express
var app          = Express();

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(BodyParser.urlencoded({ extended: true }));
app.use(BodyParser.json());
app.use(CookieParser());
app.use(helmet());

// Port Number
const port = OCAcnf.listen.port || process.env.PORT; // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = Express.Router();  // get an instance of the express Router

// REGISTER OUR ROUTES -------------------------------
if (OCAcnf.listen.pathPrefix != null) {
  // all of our routes will be prefixed with the version of the API
  app.use(OCAcnf.listen.pathPrefix, router);
  OCAlog("  - Setting pathPrefix ..........: %s", OCAcnf.listen.pathPrefix);
}

// test route to make sure everything is working
// (accessed at GET http://localhost:PORT/api)
router.get('/', function(req, res) {
  // Wrong Usage of the API, let's redirect somewhere else
  res.redirect("/");
});

// Routing Functions
mods = require("require-dir")( __dirname + "/mods/" + OCAprg, reqOptions);

// Registers all the handlers
OCAlog("\n* Registered Modules (from 'mods/' dir):");

// Cycles through the mods and registers all the routes
// for each modulus that was deployed in the mods/ directory
for (var i in mods) {
  // If we have a viable handlers array, let's go through them and
  // register the handlers with the right paths
  if (mods[i] && mods[i].handlers != null) {
    // Some information about the module being imported
    OCAlog("  - Registering Module [" + i + "] with the following methods:");
    // If the module has handlers, let's register the module
    OCAtools.registerHandlers(router, mods[i].handlers);
  } else {
    // The module does not have valid handlers
    if (typeof(mods[i]) !== "function") OCAlog("  - " + i + " ... Skipped");
  }
}

// General Server Handler
OCAserver = null;

// Listen Server
OCAlog('\n* Setting up the Listening Server (%s:%d) (TLS: %s)', 
  OCAcnf.listen.host, OCAcnf.listen.port, (OCAcnf.listen.auth == null ? "No" : "Yes"));

// Checks if we want an HTTP or HTTPS server
if (OCAcnf.listen.auth == null) {

  // No HTTPS to setup
  OCAserver = http.createServer(app);

} else {

  // Let's setup the HTTPS
  try {

    var keyFile = OCAcnf.listen.auth.privKey;
    var certFile = OCAcnf.listen.auth.certAndChain;
    var trustedFile = OCAcnf.listen.auth.trustedCas;

    // Checks for the Key
    OCAlog("  - [ load: key file, path:%s ]", keyFile);
    if (!fs.existsSync(keyFile)) {
      OCAlog("\nERROR: Cannot find the private key (auth > privKey) file ['%s'], aborting\n", keyFile);
      process.exit(1);
    }

    // Checks for the Certificate / Certificate Chain
    OCAlog("  - [ load: chain file, path:%s ]", certFile);
    if (!fs.existsSync(certFile)) {
      OCAlog("\nERROR: Cannot find the cert (auth > certChain option) file ['%s'], aborting.\n", certFile);
      process.exit(1);
    }

    // Checks for the Trusted CAs
    OCAlog("  - [ load: trusted CAs, path:%s ]", trustedFile);
    if (!fs.existsSync(trustedFile)) {
      OCAlog("\nERROR: Cannot find the cert (auth > trustedCas option) file ['%s'], aborting.\n", trustedFile);
      process.exit(1);
    }

    const httpsOptions = {
      // Secure Context Options
      maxVersion : 'TLSv1.3',
      minVersion : 'TLSv1.2',
      // Private keys in PEM format
      key : fs.readFileSync(keyFile, 'utf8'),
      // Server's Certificate in PEM format
      cert : fs.readFileSync(certFile, 'utf8'),
      // Overrides the default Mozilla's CAs
      ca : fs.readFileSync(trustedFile, 'utf8'),
      // Loads the most recent CRL
      // crl : fs.readFileSync(crlFile, 'utf8'),
      // Requires Client Authentication
      requestCert : (OCAcnf.listen.auth.requestClientCert == true ? true : false),
      // Rejects Certificates not from the Infrastructure PKI
      rejectUnauthorized : (OCAcnf.listen.auth.allowUntrustedClientCert == false ? true : false)
    };

    // Setup the HTTPS server
    OCAserver = https.createServer(httpsOptions, app);
    if (OCAserver == null) {
      throw new ApiError("Cannot create a new HTTPS server, aborting.");
      process.exit(1);
    }

  } catch (e) {
    // Error detected, aborting.
    OCAlog("Cannot Setup TLS (Server Side), aborting. (%s)", JSON.stringify(e));
    // All Done
    process.exit(1);
  }
}

// START Listening
OCAserver.listen(port);

// All Done
OCAlog('\n* Services from \'%s\' are available on port %d\n', OCApkg.name, port);
OCAlog("[=== End Server Initialization: ===]\n");

//
// SETUP the default handler for exceptions
//
process.on("uncaughtException", function OCA$uncaughtExceptionHandler(ex) {
  OCAdebug(new ApiError("Exception: " + ex,  { "Exception" : ex }));
})

// Terminating the Process gracefully
var exitFunction = function main$exitFunction(code) {
  // Adds the exit to the general Audit logs
  OCAaudit.server.add("Process ({0}) Exiting, closing logs [Pid: %d].".format(OCAprg, process.pid));
  // For each of the configured CAs, let's add the exit line
  for (var id in OCAcas.queue) {
    // Gets the CA definition
    var myCA = OCAcas.queue[id];
    // Writes into the CAs logs
    myCA.log.add("Process ({0}) Exiting, closing logs [Pid: {1}].".format(OCAprg, process.pid));
  }
};

process.on('SIGINT', function() {
  OCAdebug("SIGINT detected, calling cleanup functions (exit).");
  // Invoke the Exit Handler
  process.exit();
});

process.on('exit', (code) => {
  // Debugging Info
  OCAdebug("Process (%s) Exiting [Pid: %d]", OCAprg, process.pid);
  // Creates the log object
  var logObj = {
    "date" : new Date(), 
    "text" : "Process ({0}) Exiting, closing logs [Pid: %d].".format(OCAprg, process.pid)
  };
  // Appends the log data to the main audit file
  fs.appendFileSync(OCAaudit.server.filename, JSON.stringify(logObj) + "\n");
  // If the OCAcas is defined
  if (typeof OCAcas !== "undefined" && OCAcas.queue != null) {
    // Appends the log data to each of the CA files
    for (var id in OCAcas.queue) {
      // Retrives the CA object
      var myCA = OCAcas.queue[id];
      // Sets the text in the logObj
      logObj.text = "Process ({0}) Exiting, closing logs [Pid: {1}].".format(OCAprg, process.pid);
      // Appends the log line to the file
      fs.appendFileSync(myCA.log.filename, JSON.stringify(logObj) + "\n");
    }
  }
  // If the OCAorders is defined
  if (typeof OCAorders !== "undefined" && OCAorders.queue != null) {
    // Appends the log data for each of the Order
    for (var id in OCAorders.queue) {
      // Retrives the CA object
      var myOrd = OCAorders.queue[id];
      // Sets the text in the logObj
      logObj.text = "Process ({0}) Exiting, closing log [Pid: {1}].".format(OCAprg, process.pid);
      // Appends the log line to the file
      fs.appendFileSync(myOrd.log.filename, JSON.stringify(logObj) + "\n");
    }
  }
  // All Done
  OCAdebug("All Done, Glad to Serve You Master!");
});

// Server is listening

return 0;

function banner() {
  // Some Banner Information
  console.log("");
  console.log("// %s - v%s", OCApkg.description, OCApkg.version);
  console.log("// (C) 2020 by %s <%s>", OCApkg.author.name, OCApkg.author.email);
  console.log("// All Rights Reserved\n");
}
