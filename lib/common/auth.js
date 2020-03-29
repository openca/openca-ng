/*
 * OpenCA Labs - Authentication driver
 * Copyright (c) 2016 Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

// This Object
var me     = this;

// Crypto Object
const crypto = require('crypto');

// Needed for Initialization
const fs = require('fs');

// Users
me.users   = { };
me.clients = { };

// Active Sessions
const sessions = {};

// Initializes
exports.init = function auth$init() {

  // @desc    - parses a certificate and updates the me.clients object
  // @params  - { dirName, fileName }
  // @return  - The Certificate Object or 'null'
  function authjs$$parseCertFile( dirName, fileName ) {

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
        targetName, JSON.stringify(e));
      // Failed adding a new user
      return null;
    }

    // No Certificate Loaded
    return null;
  }

  // @desc    - parses a user file and updates the me.users object
  // @params  - { dirName, fileName }
  // @returns - The User Object or 'null'
  function authjs$$parseUserFile ( dirName, fileName ) {
    // Skips invisible files
    if (true == /^\./.test(fileName)) return null;
    // Skips non-JSON files
    if (false == /\.(json|js)+$/.test(fileName)) return null;
    // Let's return null if the file does not exist anymore
    if (!fs.existsSync(dirName + "/" + fileName)) return null;
    // Gets the User Data
    try {
      // Generates a new JSON object
      var dataObj = OCAtools.checkObjFields(JSON.parse(fs.readFileSync(dirName + "/" + fileName)), "user");
      // Checks we have a good object
      if (dataObj == null || dataObj.id == null) {
        OCAdebug("ERROR: Cannot parse the User Config File [%s]", dirName + "/" + fileName);
        return null;
      }
      // Debugging Info
      if (typeof me.users[dataObj.id] === 'undefined') {
        OCAlog("Adding New User (id: %s)", dataObj.id);
      } else {
        OCAlog("Modifying Existing User (id: %s)", dataObj.id);
      }
      // Checks if we have a certificate to parse
      if (dataObj.creds != null && typeof dataObj.creds.cert !== "undefined") {
        // Gets the certificate object
        const cert = authjs$$parseCertFile(dataObj.creds.cert);
        if (cert == null || cert == "") {
          OCAdebug("ERROR: Cannot load user cert file [%s]", dataObj.creds.cert);
          return null;
        }
        // Adds the "parsed" certificate value to the dataObj
        dataObj.creds.certValue = cert;
        // Adds the lookup reference for searching by fingerprint (hash)
        if (me.users[cert.fingerprint] != null) {
          OCAdebug("ERROR: Same Certificate use for different accounts ['%s', '%s'] is prohibited.", 
            me.users[cert.fingerprint].id, dataObj.id);
          OCAdebug("ERROR: User Disabled ['%s'] (cert fingerprint: %s).",
            dataObj.id, cert.fingerprint);
          return null;
        }

        // Adds the fingerprint of the certificate
        // to the ones allowed to connect
        me.clients[cert.fingerprint] = dataObj;
      }

      // Apply the changes
      me.users[dataObj.id] = dataObj;
      // Returns the data object
      return dataObj;

    } catch (e) {
      // Debugs the Error
      OCAdebug("Cannot parse file ['%s'], skipping.", fileName);
      console.error(e);
      // Failed adding a new user
      return null;
    }

    // No Object loaded here
    return null;
  }

  return new Promise(function auth$init$Promise(resolve, reject) {

    try {

      const path = require('path');

      // The 'user.d' directory
      const userDirName = path.resolve (__dirname + "/../../conf/" + OCAprg + "/user.d");

      // Loads Mock Data on startup
      // Global: Require Options
      var reqOptions = {
        "recurse" : true,
        "extensions" : [ '.js', '.json' ], 
        "filter" : function (path) {
          return (path.match(/._.*/) ? false : true); }
      };

      // Global: Gets Users
      me.users = {};

      // Checks if the user.d directory exists
      if (fs.existsSync(userDirName)) {
        // Loads the Users' data
        fs.readdir(userDirName, function (err, filenames) {
          // Checks for errors
          if (err) {
            OCAdebug("ERROR: %s", err);
            process.exit(1);
          }
          // Loops through the list of files
          filenames.forEach( fileName => {
            // Gets the User and updates the users' object
            var user = authjs$$parseUserFile( userDirName, fileName );
            // Updates the users' database
            if (user == null || user.id == null) {
              OCAdebug("Cannot parse user config ['%s'], skipping.", 
                userDirName + "/" + fileName);
            }
          });
        });

        // Setup the user.d watcher
        fs.watch(userDirName, (eventType, fileName) => {
          // Do not operate on non-json file types
          var user = authjs$$parseUserFile( userDirName, fileName );
          // Updates the users' database
          if (user != null && user.id != null) {
            // Updates the users' DB
            me.users[user.id] = user;
            // Some Info
            OCAlog("Modified ['%s'] Credentials for User ['%s']", eventType, user.id);
          }
        });
      }

      // All Done, no data to return
      resolve(true);

    } catch (e){
      // Debugging Information
      OCAdebug("ERROR: Exception " + JSON.stringify(e));
      // Propagates the error
      reject(new ApiError("Exception: " + e, e));
    }

  }) // End of new Promise()
}

// Checks that the auth in 'ctx' are valid (from req's cookie)
exports.checkAuth = function auth$$checkAuth(req, res, ctx, cb) {

  // Shortcut to the CTX's roles (if any)
  var uRoles = [];

  // Checks we have a good ctx, if not, let's return false
  // (default: we need to know what auth is required)
  if (!ctx) throw new ApiError("Handler set without proper Auth Params!");

  // Checks we have a good Callback
  if (req == null || res == null || typeof(cb) !== "function") {
    // Generates a new loggable ApiError
    OCAlog(new ApiError("missing arguments",
      { "req" : req, "res" : res, "ctx" : ctx, "cb" : cb }));
    // Generates a new Error message
    ctx.msg.err(new OCAErr(-2, "Internal Error"));
    // Sets the next page to be the main app one
    // ctx.msg.next(Urls['app']);
    // Reports the Error
    cb(req, res, ctx);
    // All Done
    return;
  };

  // Clears previous errors
  ctx.msg.clear();

  // Checks if we have already a session, if so, let's just continue
  // and invoke the Callback. Also, if we do not require the login
  // for the current handler, let's invoke the callback
  if (ctx.auth.login != true) {
    // Debug Info
    // console.log("[DEBUG::auth$checkAuth()] " +
    //  "No Login or Already have SessionData: login = " +
    //  ctx.auth.login + " (" + typeof(ctx.auth.login) + "), sessionData = " +
    //  ctx.sessionData + " (" + typeof(ctx.sessionData) + ")");

    // Invoke the Callback and return
    cb(req, res, ctx);
    return; // All Done
  }

  // Let's Get the OCAMsg from the Body
  var reqMsg = new OCAMsg(req.body);

  // Checks we have a valid OCAMsg
  if (reqMsg == null) {
    OCAdebug("Cannot create an OCAMsg");
    // Generates a new Error message
    ctx.msg.err(new OCAErr(501, "Malformed Request"));
    // Sets the next page to be the main app one
    // ctx.msg.next(Urls['app']);
    // Reports the Error
    cb(req, res, ctx);
    return;
  }

  // Initializes, if needed, the current session information
  if (SessionsConfig.currSessions == null) {
    SessionsConfig.currSessions = {};
  }

  // Checks if the auth information is carried in the cookie
  if (req.cookies[SessionsConfig.cookieName] != null &&
      req.cookies[SessionsConfig.cookieName] != "" &&
      req.cookies[SessionsConfig.cookieName] != "undefined" &&
      typeof req.cookies[SessionsConfig.cookieName] !== "undefined") {
    // Debugging Info
    // OCAdebug("Authentication in Cookie ==> %s", req.cookies[SessionsConfig.cookieName]);
    ctx.sessionId = req.cookies[SessionsConfig.cookieName];
    // Saves the session data in the context
    ctx.sessionData = SessionsConfig.currSessions[ctx.sessionId];
  } else if (reqMsg.auth() != null) {
    // Debugging Info
    // OCAdebug("Authentication in Message ==> %s", reqMsg.auth());
    ctx.sessionId = reqMsg.auth();
    // Saves the session data in the context
    ctx.sessionData = SessionsConfig.currSessions[ctx.sessionId];
  } else if ((ctx.clientCertificate = req.socket.getPeerCertificate(true)) != null &&
      ctx.clientCertificate.fingerprint != null) {
    // Debugging Info
    OCAdebug("Client Certificate in TLS ==> ['%s']", JSON.stringify(ctx.clientCertificate));
    // Builds the SessionID from the Certificate's Fingerprint (Sha1)
    ctx.sessionId = ctx.clientCertificate.fingerprint.replace(/\:/g, '');
    // Checks if we have the certificate configured for an account
    if (typeof me.clients[ctx.sessionId] === undefined) {
      // Builds the error message
      ctx.msg.err(new OCAErr(503, "Certificate not valid, rejected.", ctx.sessionId ))
      // Calls the Callback
      cb(req, res, ctx);
      return;
    }
    // Saves the session data in the context
    ctx.sessionData = OCAtools.deepCopy(me.clients[ctx.sessionId]);
    // Sets the authentication method
    ctx.sessionData.auth = "certificate";
    ctx.sessionData.updatedOn = new Date();
    // Deletes the credentials (not needed by the application)
    if (ctx.sessionData != null && ctx.sessionData.creds.password) delete ctx.sessionData.creds.password;
    if (ctx.sessionData != null && ctx.sessionData.creds.cert) delete ctx.sessionData.creds.cert;
    if (ctx.sessionData != null && ctx.sessionData.creds.certValue) delete ctx.sessionData.creds.certValue;
    // Let's check if login is required (usually only for end-users)
    if (ctx.sessionData.isLoginRequired == true) {
      // Clears the CTX
      delete ctx.sessionData;
      delete ctx.sessionId;
      // Builds the Error Message
      ctx.msg.err(new OCAErr(503, "Login Required, please login first."));
      // Calls the Callback
      cb(req, res, ctx)
      // All Done
      return;
    }
  } else {
    // Generates a new Error message
    ctx.msg.err(new OCAErr(503, "No Authentication Data Found, Please Verify your Credentials."));
    // Sets the next page to be the main app one
    // ctx.msg.next(Urls['app']);
    // Reports the Error
    cb(req, res, ctx);
    // All Done
    return;
  }

  // Checks if client certificate authentication is required
  if (ctx.auth.clientCertAuth == true && ctx.clientCertificate == null) {
    // Generates a new Error message
    ctx.msg.err(new OCAErr(503, "Client Certificate Authentication is required."));
    // Reports the Error
    cb(req, res, ctx);
    // All Done.
    return;
  }

  // Let's memoize the parameters
  var req = req;
  var res = res;
  var ctx = ctx;
  var cb  = cb;

  // From this line on, we require a valid login token to process
  // the request, therefore we check if we have the loginToken set
  // in the CTX. If we do not have one, let's get it from the
  // presented request cookie (eToken)

  if (ctx.sessionData == null) {
    // Clear it for safety
    ctx.sessionId = null;
    // Generates a new Error message
    ctx.msg.err(new OCAErr(403, "No Session Information, please login again."));
    // Sets the next page to be the main app one
    // ctx.msg.next(Urls['app']);
    // Reports the Error
    cb(req, res, ctx);
    // All Done
    return null;
  }

  // Checks that we have a good-standing session (not expired)
  // Now we need to check the freshness of the session
  var now = new Date();
  // Last Update for the Session
  var updated = ctx.sessionData.updatedOn ||
                ctx.sessionData.startedOn;
  if (updated != null) {
    // Expiration for the current
    var expire = new Date(updated.getTime() + SessionsConfig.maxUpdateAge);
  }

  // Checks for expiration
  if (updated == null || now > expire) {
    // Delete the Session
    delete SessionsConfig.currSessions[ctx.sessionId];
    ctx.sessionId = null;
    // Generates a new Error message
    ctx.msg.err(new OCAErr(403, "Session Expired, please login again."));
    // Sets the next page to be the main app one
    // ctx.msg.next(Urls['app']);
    // Reports the Error
    cb(req, res, ctx);
    // All Done
    return null;
  }

  // Checks we have some data to process
  if (typeof ctx.sessionData === "undefined" || ctx.sessionData == null) {
    // Builds the error
    ctx.msg.err(new OCAErr(-1, "No Session Found, Please Login."));
    // Reports the Error
    cb(req, res, ctx);
    return null;
  }

  // Client Certificate successfully validated
  try {
    // Call the Callback
    cb( req, res, ctx );
    // All Done
    return;

  } catch (e) {

    // Error while executing the callback
    throw new ApiError("Internal Error", e);
    return;
  }

  // Saves the new Updated Time
  if (SessionsConfig.currSessions[ctx.sessionId] != null) {
    SessionsConfig.currSessions[ctx.sessionId].updateOn = now;
  }

  try {
    cb(req, res, ctx);
  } catch (err) {
    OCAdebug("ERROR: " + ctx + " (async: " + ctx.isAsync + ")");
    return;
  }

  // All Done
  return;

};

// Function to check the user's credentials. We use Promises
// to provide the possibility to concatenate actions after
// the check is performed (e.g., updating the session table,
// etc.)
//
// Parameters:
// @user - It is the user identifier string (e-mail)
// @creds - It is a JSON object with { "type" : string, "value" : string }
//          structure. Supported "type" is [ "password" ]. The "value" depends
//          on the type of credentials. For "password" credentials, the "value"
//          is the user's secret
exports.checkCredentials = function(user, creds) {

  // Returns the promise
  return new Promise(function(resolve, reject) {

    try {

      // Container for the Query String
      var queryStr = "";
      var queryParams = {};

      // Checks the input parameters
      if (typeof(user) !== "string" ||  typeof(creds) !== "object") {
        // Returns the error
        reject(new OCAErr(500, "Internal Error (Missing Parameter)"));
        return;
      }

      // Reject if no user or password is given
      if (me.users[user] == "" || creds.value == "" ) {
        reject(new OCAErr(500, "Internal Error (Missing Credentials Value)"));
        return;
      }

      // Deep Copy the User's data
      var retObj = OCAtools.deepCopy(me.users[user]);

      // Performs the actual query, we do perform different queries depending
      // on the type of credentials
      switch (creds.type) {

        // Password Credentials
        case "password": {

          // Local Value
          var localSecret = retObj.creds.password;

          // DEBUG Information
          OCAdebug("login for (" + user + ") with creds type (" + creds.type + ")");

          // Checks we use a valid algorithm
          if (typeof creds.algor !== "undefined") {
            creds.algor = creds.algor.toLowerCase();
            switch (creds.algor) {

              // All Accepted Algorithms
              case "sha1":
              case "sha256":
              case "sha384":
              case "sha512":
              case "ripemd160" :
                break;

              default: {
                // Not an acceptable algorithm
                reject(new OCAErr(500, "Hashing Algorithm was rejected"));
                return;
              }
            }
          } else {
            // Default Algorithm
            creds.algor = "sha256";
          }

          // Let's setup the value to compare
          // against - could be the raw value
          // or a salted/peppered one
          var compareValue = null;

          // Let's use the pepper if we have it
          if (typeof creds.pepper !== "undefined") {

            // New Date for the Pepper String
            const date = new Date();
            // Generate the local Pepper String
            const myPepper = date.getUTCFullYear() + 
              ("0" + (date.getUTCMonth() + 1)).slice(-2) +
              ("0" + (date.getUTCDate() + 1)).slice(-2);

            // Checks that the pepper is the same or reject
            if (myPepper != creds.pepper) {
              reject(new OCAErr(300, "Freshness value stinks a little (obsolete)"));
              return;
            }
            // Calculates the right password
            compareValue = 
                crypto.createHmac(creds.algor, localSecret)
                      .update(myPepper)
                      .digest('base64');
          } else {
            // No pepper used, let's use the salted secret directly
            compareValue = retObj.creds.password;
          }

          // Compare the new value
          if (creds.value != compareValue) {
            reject(new OCAErr(300, "Credentials Invalid for " + user));
            return;
          }

          // Sets the authentication method used
          retObj.auth = "password";

        } break;

        case "certificate" : {

          // DEBUG Information
          OCAdebug("login for (" + user + ") with creds type (" + creds.type + ")");

          // Rejects unknown usernames
          if (me.users[user] == "" || creds.value == "") {
            // Rejects the Promise
            reject(user);
          }

          // Lets compare the registered certificate and
          // the one from the TLS session
          var userCert = me.users[user].creds.certValue;
          if (userCert == null || userCert.id != creds.value) {
            reject(new OCAErr(300, "Presented Certificate is not enabled for [{0}] account.".format(user)));
            return;
          }

          // Sets the authentication method used
          retObj.auth = "certificate";

        } break;

        case "token" : {

          // DEBUG Information
          OCAdebug("Token Authentication Selected.", creds.value);

          reject(new OCAErr(500, "Token Authentication not supported."));
          return;

        } break;

        // Other Creds Type
        default : {
          // Propagates the error
          reject(new OCAErr(500, "Authentication type not supported",
            { "type" : creds.type }));
          return;
        }

      } // End of Switch

      // Deletes the credentials (not needed by the application)
      if (retObj.creds.password) delete retObj.creds.password;
      if (retObj.creds.cert) delete retObj.creds.cert;

      // Returns the user data
      resolve(retObj);

    } catch (e) {
      console.error(e, 4, true);
      
      // Propagates the error
      reject(new ApiError("Auth Exception: " + e, e));
    }
  }) // End of Promise
};
