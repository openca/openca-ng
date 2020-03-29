/*
 * OCATools for OpenCA Next Generation
 * (c) 2016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

// Self Reference
var tools = this;
var clone = require("clone");

// Requirements
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, execSync, spawn, spawnSync } = require('child_process');

// Basic Configuration Options
const basedir = path.normalize( __dirname +"/../data");

// Cache
var cache = { };

// Enables different caches
var enableCache = {

  // To Override the default behavior, sets the
  // different caching options for the different
  // formats, for example:
  //
  // "json" : true,
  // "html" : true,
  // "css"  : true,

  // Disables JavaScript Caching
  "js"   : false,

  // Default Behavior
  "default" : true,
};

// ==============================
// Generic Error Message Handling
// ==============================

exports.returnError = function tools$$return_error(req, res, ctx) {

  try {

    // TODO: The use of errMsg is to avoid circular dependencies
    //       We need to investigate what generates this issue (causes
    //       the res.json(msg) to generate an exception)
    var errMsg = new OCAMsg();
    errMsg.err(new OCAErr(ctx.msg.err()));
    errMsg.__msg["links"] = ctx.msg.__msg["links"];

    // Gets the redirect URL
    var redirectUrl = errMsg.next() || (Urls != null ? Urls['app'] : null);
    errMsg.next(redirectUrl);

    // Gets the appropriate error code
    var errCode = errMsg.err().errno();
    if (errCode < 200) errCode = 401;

    // Builds the status code depending on the request method
    // to properly redirect the application in case it is needed
    if (/GET/i.test(req.method)) {
      // If GET, let's return an un-authorized request. This behavior
      // is different from POST because if we do a redirect here, the
      // requesting entity will just redirect the request, but not
      // redirect the whole page. We do not want that.

      // Checks the requested format for the data
      var fmt = req.query['f']

      // If the request path is a data path and fmt parameter
      // was not passed, let's default to html
      if (fmt == null && /^\/data\/u\//.test(req.path)) {
        // Defaults to html
        fmt = 'h';
      }

      // Matches either the '.*html$' path or the fmt parameter
      if (/html$/i.test(req.path) || fmt === 'h') {
        res.status(302);
        res.header('Location', redirectUrl);
      } else {
        res.status(errCode);
      }

    } else if (/POST/i.test(req.method)) {
      // If POST, let's directly redirect to the appropriate
      // request - this allows for automatic redirect to other
      // resources
      res.status(303);
      res.header('Location', redirectUrl);
    }

    // Sets the status and the return data
    res.json(errMsg);
    ctx.msg.clear();
    return; // All Done

  } catch (e) {
    // Here something went wrong with the JS and we
    // need to send out a generic internal error
    OCAdebug("Exception Detected: " + e + "; " + JSON.stringify(e));

    var errMsg = new OCAMsg();
    errMsg.err(new OCAErr(500, "Internal Error Detected"));
    res.status(500).json(errMsg);

    // errMsg.next(redirectUrl);
    // res.header('Location', redirectUrl);

    ctx.msg.clear();
    return;
  }

  return; // Exits
};

// ===================
// Handlers Management
// ===================

// getHandler(obj, params) where:
//
//   obj = { method : '', path : '', func : '' }
//
// The 'obj' param is mainly used in lib/tools.js/registerHandlers()
//
//   params = { login : '', roles : [ ... ], deviceId: '' }
//
// The params object is used maily in the lib/auth.js/check()
//
exports.getHandler = function tools$$get_handler(obj, params, isAsync) {

  // Input checks
  if (!obj) return undefined;

  // Context Parametes. Defaults to required login (safe side).
  if (!params) {
    // If no parameters are passed, we default to login: true
    params = { login: true, reqAdmin: false, reqGlobalAdmin: false }

  } else if (typeof params.login !== "boolean") {
    // If the login was not specified, we default to login: true
    params.login = true;
  }

  // Checks the types for reqAdmin and reqGlobalAdmin
  if (typeof params.reqAdmin !== "boolean") {
    if (typeof params.reqAdmin !== "undefined") {
      console.log("ERROR: params.reqAdmin is not a boolean (value: %s)",
        params.reqAdmin);
    }
    // Fix the error
    params.reqAdmin = false;
  }

  // Checks the types for reqGlobalAdmin
  if (typeof params.reqGlobalAdmin !== "boolean") {
    if (typeof params.reqGlobalAdmin !== "undefined") {
      console.log("ERROR: params.reqGlobalAdmin is not a boolean (value: %s)",
        params.reqGlobalAdmin);
    }
    // Fix the error
    params.reqGlobalAdmin = false;
  }
  // Reports an Error if the Async is not explicitly set
  if (typeof isAsync === 'undefined') {
    console.log("WARNING: isAync not set for " + obj.path);
  }

  // Let's now register the inner function as the callback
  var preamble = (function __auth_wrapper_setup() {

    // Reference to this object
    var ctx = {
      "auth"    : params,
      "isAsync" : isAsync,
      "func"    : obj.func,
      "msg"     : null
    };

    // Wrapping Callback which provides auth checking
    return function __auth_wrapper(req, res) {

      // Sets the default content type to also return the encoding
      res.header("Content-Type", "application/json; charset=UTF-8");

      // Resets the ctx.msg
      ctx.msg = new OCAMsg();
      ctx.sessionID = undefined;
      ctx.sessionData = undefined;

      // Let's verify the authorization
      OCAauth.checkAuth(req, res, ctx, function(req, res, ctx) {

        // Proxy for the Callback function
        var cbFunc = ctx.func;

        // If errors were set, let's send the message, and return
        if (ctx.msg.err()) {
          // Some Debugging Info
          OCAdebug("[ERROR] [Path: " + req.path + "] " + ctx.msg.err().desc());
          // Sends out the error
          tools.returnError(req, res, ctx);
          return; // All Done
        }

        // For Asynchronous handlers, we need to wrap the callback
        // so that the req and res parameters are not going away
        if (ctx.isAsync === true) {

          // Returns the function with the req, res context saved
          cbFunc = (function(__ctx) {

            // Saved References
            var req = req;
            var res = res;
            var ctx = __ctx;

            // Returns the original function
            return ctx.func;
          })(ctx);
        }

        try {

          // Calls the original function
          cbFunc(req, res, ctx);

        } catch (e) {
          // We use exceptions to convey functional errors
          // (not errors that are meant for the user, but
          // internal bugs)
          OCAdebug("Exception: " + e + " (path: " + req.path + ")");
          // Sets the error message
          ctx.msg.err(new OCAErr(500, "Internal Error"));
          // Sends out a generic error
          tools.returnError(req, res, ctx);
          // All Done
          return;
        }

        // Sends the message in the non-async case. Note that in
        // the async case, the handler is supposed to send the response
        // directly
        if (ctx.isAsync != true) {

          // Checks if we have any content, if not, we might
          // have executed some async and the message is not
          // being sent correctly (sent before everything is
          // done).
          if (ctx.msg.err == null && ctx.msg.body == null) {
            // Generates the error message
            ctx.msg.err(new OCAErr(500, "Internal Error"));
            // Generates and return the error message
            tools.returnError(req, res, ctx);
            // Cleanup the CTX message
            ctx.msg.clear();
            return;

          } else {

            // Sends the message
            res.status(200).json(ctx.msg);
            // All Done
            return;
          }

        } // End of ctx.isAsync != true

      }); // End of lib.auth.checkAuth

    }; // End of __auth_wrapper

  })(); // End of preamble assignment

  // Assigns the preamble function as the func
  obj.func = preamble;

  // Returns the modified handler
  return obj;
};

// Registers an array of handlers
exports.registerHandlers = function tools$register_handlers(router, handlers) {

  // Checks the input
  if (router == null || handlers == null) return;

  // Goes through the array of function objects. The structure
  // is as follows:
  //
  //   { method: "", path: "", func: function() {}}
  //
  // allowed methods are "get", "post", "put", "delete"
  for (var idx = 0; idx < handlers.length; idx++) {

    // Gets the Method (if none, defaults to get
    var method = ( handlers[idx].method ? handlers[idx].method : "get" );

    // Gets the Path and the callback
    var path = handlers[idx].path;
    var func = handlers[idx].func;

    // Validates the allowed method
    switch (method) {

      // Fall through for good methods
      case "get":
      case "post":
      case "put":
      case "delete":
      case "all":
        // Method is allowed
        break;

      default:
        // Here the method is not recognized, therefore rejected
        console.log("Method (" + method + ") unknown for path (" + path + ")");
        return;
    }

    // registers the handler with the router
    router[method](path, func);

    // Log
    OCAlog("    + [ method: " + method + ", path:" + path + " ]");
  }
};

// DataTypes for Object Checking
// <objType> : <defObj>
//
// <defObj> : { type: <string>, required: <boolean> }
//
// <type> : one of { "string", "object", "array", "number", "ref:<subtype>", "arrayOf:<subtype" }
//
const dataTypes = { };

// Loads and returns the field sfrom the directory
exports.loadJsonDir = function tools$loadJsonDir( dir, templateName, callback ) {

  // Return Variable
  var ret = { };

  // Some Input checks
  if (dir == null || dir == "") {
    if (callback != null) callback ( undefined );
    return false;
  }

  // We need to recover the status of the jobs here
  // Checks if the user.d directory exists
  try {
    // Checks for the directory existance
    if (fs.existsSync(dir)) {
      // Loads the Users' data
      fs.readdir(dir, function $tools$loadJsonDir$readdir (err, filenames) {
        // Checks for errors
        if (err) {
          OCAdebug("ERROR: %s", err);
          process.exit(1);
        }
        // Loops through the list of files
        filenames.forEach( function $tools$loadJsonDir$readdir$forEachFileName (fileName) {
          // Debugging Information
          OCAdebug("Loading Definitions from %s [template: %s]", fileName, templateName);
          // Let's see if it is a file to process or not to
          if (!fileName.match(/\.json$/m) || fileName.match(/^\.+/)) {
            // If a directory is present, no need to report it
            if (!fs.lstatSync(dir + "/" + fileName).isDirectory()) {
              OCAdebug("Skipping FileName: %s/%s", dir, fileName);
            }
            // Next
            return;
          }

          // Checks the fields and retains only the ones we
          // have a definition for
          var dataObj = OCAtools.checkObjFields(
              JSON.parse(
                  fs.readFileSync(
                      dir + "/" + fileName, 'utf-8'
                  )   
              ), templateName
          );

          // Checks we have a good object
          if (!dataObj || !dataObj.id) {
              OCAdebug("Malformed definition File (%s), skipping.", fileName);
              return;
          }

          // Checks for duplicates
          if (ret[dataObj.id] != null) {
            OCAdebug("Duplicate ID ['%s'] for fileName ['%s'] " +
              "(WARN: overriding with new values)", dataObj.id, fileName);
          }

          // Saves the Object in the queue
          ret[dataObj.id] = dataObj;
        });

        // Calls the callback after processing the directory
        if (typeof callback === "function" ) callback ( ret );
        else throw new ApiError("The Callback is not of type 'function', cannot call back!");
      });
    }
  } catch (e) {
    OCAdebug("ERROR: Cannot load Directory definitions from [%s] (%s).", dir, e);
    return null;
  }

  return;
};

exports.addHistory = function tools$addHistory ( obj, persist, text ) {

  // Input check
  if (typeof obj === "undefined" || obj == null ) {
    OCAdebug("ERROR: missing required parameters, historyUpdate failed.")
    return false;
  }

  // Checks for the required entries in the object ('fileName' and 'history')
  if (typeof obj['fileName'] !== "string" || obj['history'] instanceof Array !== true) {
    OCAdebug("ERROR: Missing fileName (%s) or history (%s) in object, history update failed.",
      typeof obj['fileName'] !== "string", obj['history'] instanceof Array !== true);
    return false;
  }

  // Let's add some history
  obj.history.push({ "date" : new Date(), "text" : text });

  // If required to persist, let's save it to disk
  if (typeof persist !== "undefined" && persist == true) {
    // Stores the job in the jobs directory
    fs.writeFile(obj.fileName, JSON.stringify(obj), err => {
      if (err && err.code != 'EEXIST') {
        OCAdebug("ERROR: Cannot save update history in ['" 
          + obj.fileName + "'] - %s", err);
      }
    });
  }

  // All Done
  return true;
};

// Adds a note to an object (requires the ['notes'] property
// to be present and to be an Array). If ['persist'] is set to
// true, then the object is saved to file (it requires the
// ['fileName'] property to be present)
exports.addNote = function tools$addNote ( obj, persist, text ) {

  // Input check
  if (typeof obj === "undefined" || obj == null ) {
    OCAdebug("ERROR: missing required parameters, addNote failed.")
    return false;
  }

  // Checks for the required entries in the object ('fileName' and 'history')
  if (typeof obj['fileName'] !== "string" || obj['notes'] instanceof Array !== true) {
    OCAdebug("ERROR: Missing fileName (%s) or history (%s) in object, history update failed.",
      typeof obj['fileName'] !== "string", obj['notes'] instanceof Array !== true);
    return false;
  }

  // Let's add some history
  obj.notes.push({ "date" : new Date(), "text" : text });

  // If required to persist, let's save it to disk
  if (typeof persist !== "undefined" && persist == true) {
    if (obj.fileName === "undefined" || obj.fileName == "") {
      OCAdebug("ERROR: missing ['fileName'] property in object, cannot persist.");
      return false;
    }
    // Stores the job in the jobs directory
    fs.writeFile(obj.fileName, JSON.stringify(obj), err => {
      if (err && err.code != 'EEXIST') {
        OCAdebug("ERROR: Cannot save the new note in ['" 
          + obj.fileName + "'] - %s", err);
      }
    });
  }

  // All Done
  return true;
};

exports.checkObjFields = function tools$checkObjFields ( obj, fieldsOrType, directory ) {

  // Return Value
  var retValue = { };
  var fields = fieldsOrType;

  // Checks for the Type of checks
  if (typeof fieldsOrType === "object") {

    // Validation Object already here
    fields = fieldsOrType;

  } else if (typeof "fieldsOrType" === "string") {

    // Let's see if we have the fields already
    if ((fields = dataTypes[fieldsOrType]) == null) {

      // Common directory holding definitions for shared data types
      var commonDirectory = path.resolve ( __dirname + "/../../data/common/type.d" );
      
      // Checks if we have the directory, otherwise use a
      // default one
      if (directory == null || directory == "") {
        directory = path.resolve ( __dirname + "/../../data/" + OCAprg + "/type.d");
        // OCAdebug("No directory passed, using the default one (%s)", directory);
      }

      // The complete Filename
      var fileName = directory + "/" + fieldsOrType + ".json";

      // If we do not, we try to retrieve it from the fileSystem
      if (typeof directory === "undefined" || !fs.existsSync(directory)) {
        OCAdebug("Cannot find ref/complex type (%s) [dir: %s]",
          fieldsOrType, directory);
        return null;
      }

      // Let's check if we have the file to load
      if (!fs.existsSync(fileName)) {
        // Let's check for the definition in the common directory
        fileName = commonDirectory + "/" + fieldsOrType + ".json";
        // Checks for the existance of the commong file definition
        if (!fs.existsSync(fileName)) {
          OCAdebug("Missing ref/complex file ['%s']", fileName);
          return null;
        }
      }

      // Let's load the definition from file
      try {

        // Gets the fields from the file
        fields = JSON.parse(fs.readFileSync(fileName, 'utf-8'));

        // Adds the definitions to the global dataType object
        dataTypes[fieldsOrType] = fields;
      }
      catch (e) {
        OCAdebug("Cannot parse ref/complex type definition [%s]", fileName);
        return null;
      }
    }

  } else {
    // Genral Error for fieldsOrType parameter
    OCAdebug("fieldsOrType is not a 'string' or an 'object'.");
    return null;
  }

  // Checks we have data to operate on
  if (typeof obj == "undefined" || obj == null) return null;

  // Let's copy only the relevant data in the order
  for (var field in fields) {

    var value = undefined;
    
    // Gets the Value
    value = obj[field];

    // Checks we have all required fields
    if (fields[field].required == true && 
          (typeof value === "undefined" || value == null)) {
        OCAdebug("Missing required ['" + field + "'] field in data structure.");
        return undefined;
    }

    // Let's skip the entry if we do not have the data
    // (we already checked for the 'required' attribute)
    if (typeof value === "undefined" || value == null) {
      // Nothing to do here, let's skip
      continue;
    }

    // Checks if it is a recursive check
    if (fields[field].type.match(/^ref\:/) != null) {

      // Debugging Information
      // OCAdebug("Starting Recursive Validation for ['%s'] field.", field);

      // Assigns the value from the recursive validation
      retValue[field] = OCAtools.checkObjFields (value, 
        fields[field].type.replace(/^ref\:/, ""));

      // Checks the validation did not fail, if it did,
      // we invalidate the whole data object
      if (retValue[field] == null) {
        OCAdebug("Failed validating complex value ['%s'].", field)
        return undefined;
      }

    } else if (fields[field].type.match(/^arrayOf\:ref\:/i)) {
        
        var subType = fields[field].type.replace(/^arrayOf\:ref\:/i, "");

        var valueArray = [];
        for (var i = 0; i < value.length; i++) {

          // Checks the definition for the value in the array
          var arrayValue = OCAtools.checkObjFields(value[i], subType);

          // If we do not have a good value, let's return the
          // error and an undefined result
          if (arrayValue == null) {
            OCAdebug("Failed validating complex array value ['%s'].", field)
            return undefined;
          }

          // Pushes the value to the array
          valueArray.push(arrayValue);
        }
        retValue[field] = retArray;

    } else if (fields[field].type.match(/^arrayOf\:/i)) {

      // SubType of the items in the array
      var subType = fields[field].type.replace(/^arrayOf\:/i, "");

      // Array for holding the info
      var retArray = [];

      // Cycle through all the elements of the array and
      // verify that the value is of the right type
      for (var i = 0; i < value.length; i++) {
          // Checks the definition for the value in the array
        if (typeof value[i] != subType) {
          // Wrong type
          OCAdebug("Failed validating element #%d as ('%s') of field ('%s') (should be: %s)",
            i, (typeof value[i]), field, subType);
          return undefined;
        }
        // Pushes the value to the array
        retArray.push(value[i]);
      }
      retValue[field] = retArray;

    } else {

      // Checks we have a good type for the value
      if (fields[field].type === "array" && (typeof value) === "object") {
        // If it is not an array, let's give out the error
        if ((value instanceof Array) == false) {
          // Not an Array, let's return the error
          OCAdebug("Filed (%s) is NOT an array (type: %s)", field, typeof value);
          return undefined;
        }

      } else if (typeof value != fields[field].type && value != null ) {
        // Simple Type - just check the basic types
        OCAdebug("Error in data validation: field (%s) is of type (%s) instead of (%s)",
          field, (typeof value), fields[field].type);
        return undefined;
      }

      // The value is good, let's move it to the new object
      retValue[field] = value;
    }
  }

  // Returns the sanitized object
  return retValue;

};


// @desc    - parses a certificate and updates the me.clients object
// @params  - { dirName, fileName }
// @return  - The Certificate Object or 'null'
exports.parseCertFile = function tools$parseCertFile( dirName, fileName ) {

  // Target File Name
  var targetName = ( fileName != null ? dirName + "/" + fileName : dirName);

  // Skips non-JSON files
  if (false == /\.(pem|crt|cer)+$/.test(targetName)) return null;

  // Checks if the file exists
  if (!fs.existsSync(targetName)) {
    OCAdebug("Cannot load user certificate [%s]", targetName);
    return null;
  }

  try {

    var data = fs.readFileSync(targetName).toString();
    var cert = null;

    if (data != null) {

      // Load certificate in PEM encoding (base64 encoded DER)
      const b64 = data.replace(/(-----(BEGIN|END) CERTIFICATE-----|[\n\r])/g, '')

      // Now that we have decoded the cert it's now in DER-encoding
      const der = new Buffer(b64, 'base64');

      // Generates the sha1 hash data over the DER representation of the cert
      const hash = crypto.createHash('sha1').update(der).digest('hex').toUpperCase();

      // Generates the sha256 hash data over the DER representation of the cert
      const hash2 = crypto.createHash('sha256').update(der).digest('hex').toUpperCase();

      // Adds the Certificate to the list of allowed certificates
      var certObj = { 
        "id" : hash,
        "b64" : b64,
        "der" : der,
        "pem" : data,
        "sha1" : hash,
        "fingerprint" : hash,
        "sha256" : hash2,
        "fingerprint2" : hash2
      };

      // Return Positive
      return certObj;
    }

  } catch (e) {
    // Debugs the Error
    OCAdebug("Cannot parse certificate file ('%s') [%s]", 
      targetName, e);
    OCAdebug(e);
    // Failed adding a new user
    return null;
  }

  // No Certificate Loaded
  return null;
}

// =========================
// CA Enabling and Disabling
// =========================

exports.enableCA = function tools$$enableCA ( ca ) {
  if (ca.key == null) return false;
  if (ca.cert == null) return false;
  OCAdebug("Missing Code for this function, returning always 'true'");
  ca.enabled = true;
  return true;
};

exports.disableCA = function tools$$disableCA ( ca ) {
  OCAdebug("Missing Code for this function, returning always 'true'");
  ca.enabled = false;
  return true;
};

// ==================
// CA Keys Operations
// ==================

exports.newCaKey = function tools$$newCaKey ( ca, key, callback ) {

  // Crypto Service Provider
  var csp = null;

  // Crypto Cmd to Invoke
  var targetCmd = null;
  var cmd = null;

  // Throws if no callback is passed to the function
  if (callback == null) throw new ApiError("Callback for CA key generation is missing.");

  // Very quick parameters checking
  if (ca == null || key == null || callback == null) {
    var err =  new OCAErr(500, "Missing ca or key objects");
    callback(err, null);
    return;
  }

  // Let's get the CSP configuration
  if ((csp = OCAcsps.queue[key.type]) == null) {
    // Missing Key Type
    var err = new OCAErr(501, "CSP {0} not available on this host.".format(csp.id));
    callback(err, null);
    return;
  } else if (csp.enabled != true) {
    // Disabled CSP
    var err = new OCAErr(502,"CSP {0} not enabled on this host.".format(csp.id));
    callback(err, null);
    return;
  }

  var opt = null;

  // Lets check which command we need to execute
  if (key.value != null) {
    targetCmd = "keyImport";
    opt = {
      "data" : key.value
    };
  } else if (key.wrapValue != null) {
    targetCmd = "keyUnwrap";
  } else {
    targetCmd = "keyCreate";
    // Setup the Options object with the variables
    // we need to substitute in the command line invocation
    opt = {
      "params" : {
        "bits" : key.algorithm.params.bits,
        "curve" : key.algorithm.params.curve
      }
    };
  }

  // Let's see if the selected type has key creation turned on
  if (csp.capabilities[targetCmd] == null || csp.capabilities[targetCmd].enabled == false) {
    var err = new OCAerr(503, "CA Key Creation is disabled for CSP [{0}:{1}]".format(csp.id, targetCmd));
    callback(err, null);
    return;
  }

  // Let's get the CMD to execute for the specific algorithm
  if ((cmd = csp.capabilities[targetCmd].cmd[key.algorithm.id]) == null) {
    var err = new OCAErr(503, "Missing CMD configuration for Algorithm [{0}] in [{1}:{2}]"
      .format(key.algorithm.id, csp.id, targetCmd));
    callback(err, null);
    return;
  };

  // Setup the Options object with the variables
  // we need to substitute in the command line invocation
  var opt = {
    "params" : {
      "bits" : key.algorithm.params.bits,
      "curve" : key.algorithm.params.curve
    }
  };

  // Executes the command
  OCAtools.execCmd(csp.capabilities[targetCmd].cmd[key.algorithm.id], opt, (err, data) => {
    // Checks for the error condition first
    if (err) {
      OCAaudit.server.add("Error while initializing the key for CA [{0}] ({1}:{2}).".format(ca.id, csp.id, key.algorithm.id));
      callback(err);
      return;
    }
    // Let's call the callback function
    callback(null, data);
    // All Done.
    return;
  });

  return;
};

// ===================
// CLI Execution Tools
// ===================

/*
 * execCmd() - Executes a CLI command and returns the data via the callback
 * @params { cmd, opt, callback }, where:
 * @cmd      - The CLI to be executed
 * @opt      - the object with the named parameters for 
 *             substitution ${varName}, can be null
 * @callback - callback for retrieving the output of CLI (can be null)
 */
exports.execCmd = function tools$$execCmd( cmd, opt, callback ) {

  // Data to be returned via the callback
  var retData = null;

  // Fix the parameters
  if (typeof opt === "function") {
    callback = opt;
    opt = null;
  }

  // Setup for the exec environment
  var execOptions = { 
    "timeout" : (opt != null ? opt.timeout : undefined),
    "input" : ( opt != null ? opt.data : undefined ),
    "windowsHide" : true
  };

  // Finalized command line
  var execCli = cmd;

  // Should execute the Command, then the callback with the received
  // data (if present)
  if (cmd == null) {
    if (callback != null) callback();
    else return false;
  }

  // Getting the Variables Substitution
  if (opt != null && opt.params != null) {
    for (var i in opt.params) {
      execCli = execCli.replace("${" + i + "}", opt.params[i]);
    }
  }

  // Sets the ENV variables for the CLI
  if (opt != null && opt.env != null) {
    for (var i in opt.env) {
      execCli =  i + "=\"" + opt.env[i] + "\" " + execCli;
    }
  }

  // Executes the command and gets the output
  exec(execCli, execOptions, function $tools$exec$innerCallback( err, stdout, stderr ) {
    // Checks for errors
    if (err) {
      var error = new OCAErr(err.code, "Error while trying to execute ['{0}']".format(execCli));
      callback(error, null);
      return;
    }

    // Calls the callback
    callback(null, stdout);
  });

  // Returns true
  return true;
};

exports.rmdirSync = function tools$rmdirSync(dirName) {

  if (fs.existsSync(dirName)) {
    fs.readdirSync(dirName).forEach((file, index) => {
      const curPath = path.join(dirName, file);
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        tools$rmdirSync(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirName);
  }
};

// ==================
// Session Management
// ==================

exports.updateSessionData = function tools$$update_session_data(req, res, ctx) {
}

// =====================
// Static Data Retrieval
// =====================

exports.getStaticData = function tools$$get_static_data(params, cb) {

  // Function Variables
  var srcPath = undefined;
  var encoding = 'utf-8';

  // Input Checks: required oaraneters
  if (typeof(params)      !== "object"  ) throw new ApiError("ERROR: params must be an object");
  if (typeof(params.name) !== "string"  ) throw new ApiError("ERROR: name is not a string");
  if (typeof(cb)          !== "function") throw new ApiError("ERROR: cb is not a function");

  // Input Checks: optional parameters
  if (typeof(params.isPublic) === "undefined") params.isPublic = true; // Defaults to public
  if (typeof(params.fmt)      === "undefined") params.fmt = "html"; // Defaults to HTML
  if (params.srcPath && typeof(params.srcPath) !== "string") throw new ApiError("ERROR: srcPath is not a string");

  // Sets the value of srcPath to basedir in case none was provided
  if (!params.srcPath) {

    // Sets the right directory for public or private (user) calls
    if (params.isPublic) srcPath = path.join (basedir, "pub", params.fmt.toLowerCase());
    else srcPath = path.join(basedir, "user", params.fmt.toLowerCase());

  } else {

    // If the path is provided, let's use it entirely if it is an
    // absolute path, otherwise we add it as a subdir of the data path
    if (path.isAbsolute(params.srcPath) != true) {
      // Prepends the basedir and normalizes
      srcPath = path.join(basedir, path.normalize(params.srcPath.replace("..", "")));
      if (params.isPublic) srcPath = path.join(basedir, "pub", path.normalize(params.srcPath));
      else srcPath = path.join(basedir, "user", path.normalize(params.srcPath));
    } else {
      // Just use the normalized version of the passed srcPath
      srcPath = path.normalize(params.srcPath);
    }
  }

  // Make a local copy for the callback
  var src = path.join(srcPath, params.name.replace("..", ""))
  if (params.fmt.length > 0) {
    src += "." + params.fmt.toLowerCase();
  }

  // Checks if we have a cache already
  if (typeof(cache[src]) !== "undefined") {
    // Returns the cached data
    return cb(cache[src]);
  }

  // Loads from the FS
  fs.readFile(src, params.encoding, function(err, data) {

    // JSON return body
    var json = undefined;
    var isCached = false;

    // Error while reading the file
    if (err != null) {
      console.log("[tools::getStaticData] Internal Error (err: " + err + ")");
      return cb(null);
    }

    // Processing based on the type
    if (params.fmt == 'json') {

      // If a JSON is expected, try to parse it before caching it
      // and returning it to the client
      try {

        // Parse the data - validate JSON (strict mode)
        json = JSON.parse(data);

      } catch (e) {
        // Let's Fix the JSON before parsing it
        var data_new = data.replace(/(['"])?([^\s]+)(['"])?\s*\:\s*(.*)/g,
                                    '"$2" : $4');

        try {

          // Parses the modified data
          json = JSON.parse(data_new);

          // Reports the issue with the JSON to be fixed
          if (!src.match("mock-data")) {
            console.log("[ERROR] " + src + " is not a strict JSON file, fix it!");
          }

        } catch (f) {

          // Reports the NON RECOVERABLE error
          throw "[ERROR] " + src + " is not a valid JSON file (ex: " + f + ")";
        }
      }

      // Saves the new parsed json into the 'data' variable
      data = json;
    }

    // Just memoizes the data (no processing)
    if (typeof(enableCache[params.fmt]) != 'undefined') {
      // Memoizes only if the format is set to be cached (or if default
      // value is set to true)
      if (enableCache[params.fmt] || params.forceCache) {
        cache[src] = data;
        // Sets the appropriate value for the cache
        isCached = true;
      } else if (enableCache.default == true) {
        cache[src] = data;
        isCached = false;
      }
    }

    // Call the callback
    return cb(data, isCached);
  });
};


//
// Private Data Methods (login required)
//

exports.getMockData = function tools$$get_mock_data(dir, name, fmt, cb) {

  // Builds the filename
  var src = path.join(dir, "mock-data");
  var params = { "name" : name, "fmt" : "json", "isPublic" : false, "srcPath" : src };

  // Calls the Get Static Data with the isJSON bit set to true
  return tools.getStaticData( params, cb);
};

exports.getStaticHTML = function tools$$get_static_html(name, cb) {

  // Parameters
  var params = { "name" : name, "fmt" : "html", "isPublic" : false };

  // Calls the Get Static Data with the appropriate subdirectory
  return tools.getStaticData(params, cb);
};

exports.getStaticJS = function tools$$get_static_js(name, cb) {

  var params = { "name" : name, "fmt" : "js", "isPublic" : false};

  // Calls the Get Static Data with the appropriate subdirectory
  return tools.getStaticData(params, cb);
};

//
// Public Data Retrieval Methods (login NOT required)
//

exports.getPublicJSON = function tools$$get_static_json(name, cb) {

  // Calls the Get Static Data with the isJSON bit set to true
  return tools.getStaticData({ "name" : name, "fmt" : "json", "isPublic" : true }, cb);
};

exports.getPublicJS = function tools$$get_public_js(name, cb) {

  var params = { "name" : name, "fmt" : "js", "isPublic" : true };

  // Calls the Get Static Data with the appropriate subdirectory
  return tools.getStaticData(params, cb);
};

//
// User Tools
//

exports.sanitizeUserId = function OCAtools$sanitizeUserId(userId) {
  if (!userId || typeof userId !== "string") throw new ApiError("Missing userId");
  return userId.replace(/[.!/$]+/gi, "");
}

// ======================
// Prototype Enhancements
// ======================

Array.prototype.has = function(data) {
  var i = -1;
  while (i++ < this.length) {
    if (this[i] === data || this[i] == data) return true;
  }
  return false;
}

Array.prototype.sum = Array.prototype.sum || function() {
  return this.reduce(function(sum, a) { return sum + Number(a) },  0);
}

Array.prototype.average = Array.prototype.average || function() {
  return this.sum() / (this.length || 1 );
}

String.prototype.format = function $tools$String$format () {

  /*
  var a = this;
  for ( var k in arguments ) {
    a = a.replace(new RegExp("\\{" + k + "\\}", 'g'), arguments[k]);
  }
  return a;
  */

  var fmt = this;
  if (!fmt.match(/^(?:(?:(?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{[0-9]+\}))+$/)) {
      throw new Error('invalid format string.');
  }
  return fmt.replace(/((?:[^{}]|(?:\{\{)|(?:\}\}))+)|(?:\{([0-9]+)\})/g, (m, str, index) => {
    if (str) {
        return str.replace(/(?:{{)|(?:}})/g, m => m[0]);
    } else {
        if (index >= arguments.length) {
            throw new Error('argument index is out of range in format');
        }
        return arguments[index];
    }
  });

};

/*
Object.prototype.getName = function() {
   var funcNameRegex = /function (.{1,})\(/;
   var results = (funcNameRegex).exec((this).constructor.toString());
   return (results && results.length > 1) ? results[1] : "";
};
*/

exports.deepCopy = function OCA$deepCopy (obj) {

    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}

// Sprintf function that usese {0}, {1}, ... {X}
// as arguments placeholders
exports.sprintf = function tools$sprintf( str, ...args) {
  return str.format(...args);
};

