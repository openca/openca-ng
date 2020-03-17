/*
 * FE/BE Queue Management For OpenCA NG
 * (c) 2016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved 
 */

/* This object provides a high-level interface that allows
 * queuing and de-queuing items for FE/BE communication.
*/

// Constructor for OCAErr
function OCAbeq(dir, options) {

  // Reference to itself
  var me      = this;

  // References to local references for args
  me.dir = dir;
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

  // Initial Status
  me.status = me.SUBMITTED;

  // Let's get the Tools from the parameters
  if (options == null) {
    throw new ApiError("Missing parameters ('options'), fatal error.");
    return;
  }

  // Checks we have the Id of "this" frontend
  // to avoid loops / mis-configurations
  if (options.localId == null) {
    // Fatal Error Condition
    throw new ApiError("Missing Local Frontend ID (options.localId), fatal error.");
  }

  // Let's copy the local id
  me.localId = options.localId;

  // Let's check we have the required OCAtools object
  if (options.OCAtools == null) {
    // Gets a local reference to the OCAtools
    me.OCAtools = options.OCAtools;
  } else if (OCAtools == null) {
    // Gets a local reference from the global Object
    me.OCAtools = OCAtools;
  } else {
    // We need the OCAtools, throw the fata error
    throw new ApiError("Missing OCAtools reference (options.OCAtools or global OCAtools), fatal error.");
    return;
  }

  // Let's check we have the required OCAtools object
  if (options.OCApath == null) {
    // Gets a local reference to the OCAtools
    me.OCApath = options.OCApth;
  } else if (OCAtools == null) {
    // Gets a local reference from the global Object
    me.OCApath = OCApath;
  } else {
    // We need the OCAtools, throw the fata error
    throw new ApiError("Missing OCAtools reference (options.OCApath or global OCApath), fatal error.");
    return;
  }

  // Function to check the outbound / inbound
  // directories creation

  // Checks for the basic parameter
  if (typeof dir === "undefined" || dir == null) {
    throw new ApiError("Cannot instantiate OCAaudit object, missing [dir] parameter.");
    return undefined;
  }

  // Checks for the directory's existance
  if (!me.fs.existsSync(dir)) {
    throw new ApiError("Audit directory [{0}] does not exists.".format(dir));
    return undefined;
  }

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

  // Setup the user.d watcher
  me.fs.watch(dir, (eventType, fileName) => {
    // Do not operate on non-json file types
    OCAlog("Modified [evt: '%s'] Frontend [fileName: '%s']", eventType, fileName);
    OCAdebug("Missing Code for handling changes in Frontend configs.")
  });

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

OCAbeq.prototype.list = function OCAbeq$prototype$list () {
  var me = this;
};

OCAbeq.prototype.submit = function OCAbeq$prototype$submit () {
  var me = this;
};

OCAbeq.prototype.process = function OCAbeq$prototype$process () {
  var me = this;
};

OCAbeq.prototype.reject = function OCAbeq$prototype$reject () {
  var me = this;
};

OCAbeq.prototype.abort = function OCAbeq$prototype$reject () {
  var me = this;
};

OCAbeq.prototype.complete = function OCAbeq$prototype$reject () {
  var me = this;
};

OCAbeq.prototype.update = function OCAbeq$prototype$transition ( item, setStatus ) {
  var me = this;
};

if (typeof(exports) !== "undefined") {
  exports.OCAbeq = OCAbeq;
}


