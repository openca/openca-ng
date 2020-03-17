/*
 * OCAsync For OpenCA NG
 * (c) 2016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved 
 */

/* This object provides a high-level interface that allows
 * synchronization between front-end and back-end.
 *
 * This interface provides:
 *
 *  - Client Support for OnLine Backends:
 *    + Order Submission from user to backend
 *    + Order Polling from user to backend (ready / not-ready )
 *    + Order Completion Retrieval from Backend to FrontEnd
 *  - Client Support for OffLine Backends:
 *    + Order Queuing for off-line backend
 *    + Order Retrieval for Backend Submission (requires global admin)
 *    + Order Completion Submission from offline Backend (requires global admin)
*/

// Constructor for OCAErr
function OCAbesync(dir, options) {

  // Reference to itself
  var me      = this;

  // Crypto and FS Object
  me.crypto   = require('crypto');
  me.fs       = require('fs');

  // List of Front Ends
  me.list     = { }

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

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

OCAbesync.prototype.add = function OCAbesync$prototype$add (text) {
  var me = this;
};

OCAbesync.prototype.sign = function OCAbesync$prototype$sign() {
  var me = this;
};

if (typeof(exports) !== "undefined") {
  exports.OCAbesync = OCAbesync;
}


