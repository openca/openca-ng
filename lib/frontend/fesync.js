/*
 * Front-End Sync For OpenCA NG
 * (c) 2016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved 
 */

/* This object provides a high-level interface that allows
 * synchronization between front-end and back-end.
 *
 * This interface provides:
 *  - Client Support for Proxy-Frontends:
 *    + Order Polling through another frontend
 *      (requires global admin - carries the original user requesting it for authorization checking)
 *    + Order Completion Retrieval through another frontend 
 *      (requires global admin - carries the original user requesting it for authorization checking)
 *  - Global Queries to all Frontends:
 *    + Retrieve the list of available CAs (owned by the org - if admin, allowed for globalAdmins)
 *  - Front-End Synchronization Interface:
 *    + User Creation Synchronization (submits the creation locally and to all FEs, if any rejection,
 *      the user is not created) (requires original submit plus original submitter for auth checking)
 *    + Organization Creation Synchronization (submits the creation locally and to all FEs, if any
 *      rejection is detected, the org is deleted everywhere - the original submitter is retained for
 *      auth checking)
 *    + Product Creation Synchronization (submits the creation locally and to all FEs, if any
 *      rejection is detected, the org is deleted everywhere - the original submitter is retained for
 *      auth checking)
*/

// Constructor for OCAErr
function OCAfesync(dir, options) {

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

  // Function to check the connectivity for
  // online backend
  me.checkConnection = function (beConfig, callback) {
    // Here it should return false in case of errors
    // thus enabling/disabling the front-end support.
    // If errors are encountered, the callback will have
    // the err parameter not null
    callback(null, { "sync" : "successful" });
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

OCAfesync.prototype.add = function OCAfesync$prototype$add (text) {
  var me = this;
};

OCAfesync.prototype.sign = function OCAfesync$prototype$sign() {
  var me = this;
};

if (typeof(exports) !== "undefined") {
  exports.OCAfesync = OCAfesync;
}


