/*
 * FE/BE Queue Management For OpenCA NG
 * (c) 2016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved 
 */

/* This object provides a high-level interface that allows
 * queuing and de-queuing items for FE/BE communication.
*/

// Constructor for OCAErr
function OCAfeq(config, options) {

  // Reference to itself
  var me      = this;

  // References to local references for args
  me.config = config;
  me.options = options;

  // Crypto and FS Object
  me.crypto   = require('crypto');
  me.fs       = require('fs');

  // List of Supported Backends
  me.list     = { "queue" : {} };

  // Set of Status for the Items
  me.SUBMITTED  = "SUBMITTED";
  me.PROCESSING = "PROCESSING";
  me.REJECTED   = "REJECTED";
  me.ABORTED    = "ABORTED";
  me.COMPLETED  = "COMPLETED";

  // Allowed Statuses Transitions
  me.transitions = {
    "SUBMITTED" : [ me.REJECTED, me.PROCESSING ],
    "PROCESSING": [ me.ABORTED, me.COMPLETED ],
    "REJECTED" : [],
    "ABORTED" : [],
    "COMPLETED" : []
  };

  var item_st = {
    "target" : "",
    "type" : "",
    "data" : { },
    "callback" : { }
  };

  // Initial Status
  me.connected = false;

  function __get_opt(options, nameArray) {
    // Return Variable
    var ret = undefined;
    // Input check
    if (nameArray == null || nameArray.length < 1) {
      throw new ApiError('Missing array of names to import, fatal error.');
      return;
    }
    // Cycle through all the names
    for (var i = 0 ; i < nameArray.length; i++) {
      // Shortcut for the property name
      var name = nameArray[i];
      // Let's check for the OCAquery object from the engine
      if (options[name] != null) {
        // Gets a local reference to the OCAtools
        me[name] = options[name];
      } else if (global[name] != null) {
        // Gets a local reference from the global Object
        me[name] = global[name];
      } else {
        var text = "Missing [" + name + "'] reference (options.['{0}'] or global ['{0}']'), fatal error.".format(name);
        // We need the OCAtools, throw the fata error
        throw new ApiError(text);
        return false;
      }
    }
    // Returns the object
    return true;
  }


  // Let's get the Tools from the parameters
  if (options == null) {
    throw new ApiError("Missing parameters ('options'), fatal error.");
    return;
  }

  // Checks we have the Id of "this" frontend
  // to avoid loops / mis-configurations
  if (options.localId == null) {
    // Fatal Error Condition
    throw new ApiError("Missing Local Backend ID (options.localId), fatal error.");
  }

  // Let's shortcut the local id
  me.localId = options.localId;

  if (__get_opt(options, [ "OCAtools", "OCApath", "OCAquery", "OCAengine" ]) != true) {
    // Initialization error
    throw new ApiError("Initialization error detected, fatal.");
    return;
  }

  // Let's initialize the TLS interface
  if (config.clientAuth) {
    // Loads the key, cert, and chain into the tlsOptions
    me.tlsOptions = OCAengine.TlsCryptoInit(config.clientAuth);
  } else {
    // Empty Object
    tlsOptions = {};
  }

  if (config.serverAuth != null) {
    me.tlsOptions.serverAuth = config.serverAuth;
    me.tlsOptions.serverAuth.callback = function() {
      OCAdebug("We need to check the server's identity here, missing code.");
    }
  }

  // Sets a timer to double each time so as not
  // to flood the host with un-answered requests
  var sleepTime = 1;

  // Timer function to connect to the FrontEnd
  function __check_fe_connection() {
    // Sends the Query and Process the Response
    me.OCAquery("post", me.config.baseUrl + "/u/login", me.tlsOptions, {}, (msg, res) => {
        OCAdebug("Callback Invoked!");
        // Display the Message
        if (msg.err() != null) {
          // Update the sleepTime value
          sleepTime = ((sleepTime * 2) % 16) || 1;
          // ERROR, let's display it
          OCAdebug("Checking connection again in %d minutes [%s]", sleepTime, me.config.id);
          // Set the new Timer
          setTimeout(__check_fe_connection, sleepTime * 1000 );
          // Nothing else to do
          return;
        }
        // Successfully Connected to the FrontEnd
        OCAdebug("Successfully connected to configured FrontEnd [%s]")
      }
    )
  }

  __check_fe_connection();


  // Checks for the basic parameter
  /*
  if (typeof dir === "undefined" || dir == null) {
    throw new ApiError("Cannot instantiate OCAaudit object, missing [dir] parameter.");
    return undefined;
  }

  // Checks for the directory's existance
  if (!me.fs.existsSync(dir)) {
    throw new ApiError("Audit directory [{0}] does not exists.".format(dir));
    return undefined;
  }
  */

/*
  // Loads the Users' data
  me.fs.readdir(dir, function (err, filenames) {
    // Checks for errors
    if (err) {
      OCAdebug("ERROR: %s", err);
      return;
    }
    // Loops through the list of files
    filenames.forEach( fileName => {
      // Gets the User and updates the users' object
      try {
        // Generates a new JSON object
        var dataObj = OCAtools.checkObjFields(JSON.parse(me.fs.readFileSync(me.dir + "/" + fileName)), "frontend", OCApath.type);
        // Checks we have a good object
        if (dataObj == null || dataObj.id == null) {
          OCAdebug("ERROR: Cannot parse Frontend Config File [%s]", me.dir + "/" + fileName);
          return;
        }

        // Checks the connectivity and, if no errors are found, adds
        // the config to the list of available frontend for sync
        me.checkConnection(dataObj, (err, data) => {
          if (err) {
            OCAdebug("ERROR: Cannot add ['%s'] frontend for Synchronization (err: %s)", dataObj.id, )
          }
          me.list.queue[dataObj.id] = dataObj;
          OCAdebug("Successfully added ['%s'] frontend for Synchronization.", dataObj.id);
        })

        // DEBUG
        OCAdebug("Missing Code for Processing Front-Ends Initialization");
      } catch (e) {
        // Debugs the Error
        OCAdebug("Cannot parse file ['%s'], skipping.", fileName);
        console.error(e);
        return;
      }
    });
  });
  */

  /*
  // Setup the user.d watcher
  me.fs.watch(dir, (eventType, fileName) => {
    // Do not operate on non-json file types
    OCAlog("Modified [evt: '%s'] Frontend [fileName: '%s']", eventType, fileName);
    OCAdebug("Missing Code for handling changes in Frontend configs.")
  });
  */

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

OCAfeq.prototype.list = function OCAfeq$prototype$list () {
  var me = this;
};

OCAfeq.prototype.submit = function OCAfeq$prototype$submit () {
  var me = this;
};

OCAfeq.prototype.process = function OCAfeq$prototype$process () {
  var me = this;
};

OCAfeq.prototype.reject = function OCAfeq$prototype$reject () {
  var me = this;
};

OCAfeq.prototype.abort = function OCAfeq$prototype$reject () {
  var me = this;
};

OCAfeq.prototype.complete = function OCAfeq$prototype$reject () {
  var me = this;
};

OCAfeq.prototype.update = function OCAfeq$prototype$transition ( item, setStatus ) {
  var me = this;
};

if (typeof(exports) !== "undefined") {
  exports.OCAfeq = OCAfeq;
}


