/*
 * Users Functions - Login, Logout, and Register
 * Copyright (c) 2016 Massimiliano Pala and Teza Realty
 * All Rights Reserved
 */

// This Object
const me = this;
const handlers = [];
const users = {};

// Crypto Requirements
const crypto = require("crypto");

// Shortcut
const getHandler = OCAtools.getHandler;


                        // =======================
                        // API Handlers [/usr/...]
                        // =======================


// Login
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/usr/login/:org", func: function user$login (req, res, ctx) {

    // console.log("DEBUG: REQ BODY", req.body);
    // console.dir(req.body);

    // Let's Build the Message
    var reqMsg = new OCAMsg(req.body);

    // Checks the body
    if (reqMsg              == null || 
        reqMsg.body()       == null ||
        reqMsg.body().uid   == null ||
        reqMsg.body().creds == null ) {
      // Missing required data, returning the error to the client
      ctx.msg.err(new OCAErr(400, "Malformed request"));
      res.json(ctx.msg);
      return;
    }

    // Gets the Organization to Login into
    var org = req.params.org;

    // Gets the credentials
    var user = reqMsg.body().uid;
    var creds = reqMsg.body().creds;
    var userID = null;
    var isMobile = false;

    // Checks for Mobile Devices
    if (req.headers && req.headers['user-agent'] && 
        req.headers['user-agent'].search("Mobi") == true) {
      // Sets the Mobile Attribute
      isMobile = true;
    } else {
      isMobile = false;
    }

    // Input Check
    if (!user || !creds || !creds.type) {
      // Sets the error in the message
      ctx.msg.err(new OCAErr(-1, "Credentials format error"));
      // Sends the JSON message
      res.json(ctx.msg);
      // Exits the handler
      return;
    }

    // Let's check if certificate-based authentication is used.
    if (creds.type == "certificate") {
      // Gets the certificate from the request socket object
      var cert = req.socket.getPeerCertificate(true);
      // Checks if we have a good peer certificate
      if (cert != null && cert.fingerprint != null) {
        // Stores the (sha1) hash of the certificate as the value
        creds.value = cert.fingerprint.replace(/\:/g, '');
        // Sets the certificate as the clientCertificate for the session
        ctx.clientCertificate = cert;
      }
    }

    // Workflow to be implemented.
    // (a) Checks the Credentials for the user
    // (b) Deletes existing sessions (for the media)
    // (c) Creates a new Session
    // (d) Generates a new loginToken
    // (e) Encrypts the loginToken and saves it in the
    //     response via the appropriate login cookie
    OCAauth.checkCredentials(user, creds)
      // We need to remove existing session and create a new one in the
      // database (to prevent account sharing). We do allow to have a
      // mobile and non-mobile access at the same time (usability)
      .then(function OCAauth$checkCredentials$NewSession (data) {

        // Checks the result of the operation and returns an error
        // in case the credentials were not accepted
        if (data == null || data.id == null) {
          // Ignore the rest of the Promise chain
          return Promise.reject("rejected");
        }

        // Initializes, if needed, the current session information
        if (SessionsConfig.currSessions == null) {
          SessionsConfig.currSessions = {};
        }

        // Deletes any previous session info for the user
        for (const sessionId in SessionsConfig.currSessions) {
          // Checks if a session exists
          if (SessionsConfig.currSessions[sessionId] != null && 
              SessionsConfig.currSessions[sessionId].id != null) {
            // Deletes the found session
            if (SessionsConfig.currSessions[sessionId].id == user) {
              delete SessionsConfig.currSessions[sessionId];
            }
          }
        }

        // Generates a new Session Id
        const buf = Buffer.alloc(16);
        const newSessionId = crypto.randomFillSync(buf).toString('base64');

        // Adding the New Session Id to the currSessions object
        SessionsConfig.currSessions[newSessionId] = data;
        data.startedOn = new Date();

        // Check if we have a global admin or not
        if (data.isGlobalAdmin != true) {
          // If the user is not a global admin, we need to check the
          // user to be part of the organization
          OCAdebug("MISSING CODE: We need to check if the user is part of the organization [%s]", org);
          if (OCAorgs.queue[data.id] == null || OCAorgs.queue[data.id] == "") {
            // Debugging Information
            OCAdebug("User [%s] was not recognized as part of [%s] organization.", data.id, org);
            ctx.msg.err(new OCAErr(503, "User is not part of the organization, aborting."));
            res.status(503).json(ctx.msg);
            return;
          }
        }

        // Checks the data to be sure we have a good session ID
        // note that the maxAge parameter is in milliseconds
        res.cookie(SessionsConfig.cookieName, newSessionId, {
          "maxAge": SessionsConfig.cookieMaxAge,
          "domain": SessionsConfig.cookieDomain,
          "httpOnly": false, // If false, Gives acesss to the cookie to the client-side JS
          "secure": true });

        // Sets the auth Token
        ctx.msg.auth(newSessionId);
        // Sets a Body in the message
        ctx.msg.body({ "status" : "success"});
        // Returns the message to the caller
        res.json(ctx.msg);
        // TODO: Remove the Debug Statement
        return; // Safety
      })
      .catch(function(err) {
        // Some logging
        OCAdebug("Error, Credentials not recognized (%s)", JSON.stringify(err));
        // Credentials not valid
        ctx.msg.err(new OCAErr(-1,
          "Login failed, please check your credentials and try again."));
        ctx.msg.body({ "status" : "Credentials not valid"});
        // Sets the HTTP return code
        res.status(200).json(ctx.msg);
        return;
      }); // End of CheckCredentials Promise Chain

  } // End of getHandler() call

}, { login: false, reqAdmin: false, reqGlobalAdmin: false }, true));

// Logs Out
//
// AuthParams = { login: true }
handlers.push(
  getHandler({ method: "post",
               path: "/usr/logout", func: function User$Logout (req, res, ctx) {

    OCAdebug("Params ( " + req.path + " ) : " + JSON.stringify(req.params));

   // Let's Build the Message
    var reqMsg = new OCAMsg(req.body);

    // Checks the body
    if (reqMsg              == null || 
        reqMsg.auth()       == null ) {
      // Missing required data, returning the error to the client
      ctx.msg.err(new OCAErr(400, "Malformed request"));
      res.json(ctx.msg);
      return;
    }

    // Initializes, if needed, the current session information
    if (SessionsConfig.currSessions == null) {
      ctx.msg.err(new OCAErr(500, "Missing Session Information."))
      res.json(ctx.msg);
      return;
    }

    // Logs out from the current session
    SessionsConfig.currSessions[ctx.sessionData.id]
    // Deletes any previous session info for the user
    for (const id in SessionsConfig.currSessions) {
      // Gets the session data for each of the active ones
      var tmpSession = SessionsConfig.currSessions[id];

      if (tmpSession != null && tmpSession.id == ctx.sessionData.id) {  
        OCAdebug("Deleting Session (logout) %s for user %s", sessionId, tmpSession.id);
        // Deletes the found session
        delete SessionsConfig.currSessions[sessionId];
        SessionsConfig.currSessions[sessionId] = undefined;
      }
    }

    // Clears the Cookie
    res.clearCookie(SessionsConfig.cookieName);
    // Fills the MSG details
    ctx.msg.body({ status: "success" });
    // ctx.msg.next(lib.urls['app']);
    res.status(200).header('Location', Urls['app']);
    // Returns the Message
    res.json(ctx.msg);
    return; // Safety

}}, { login: true, reqAdmin: false, reqGlobalAdmin: false }, true));

// New User Registration
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/usr/register", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));

// Delete an existing user
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/usr/:id/remove", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));

// Exports only the handlers
exports.handlers = handlers;

// Heartbeat
//
// AuthParams = { login: true }
handlers.push(
  getHandler({ method: "post",
               path: "/usr/hb", func: function (req, res, ctx) {
    OCAdebug("[DEBUG::/usr/hb] Received HB")
    // Heartbeat Response Message
    ctx.msg.body({"status" : "ok"});
}}, { login: true, reqAdmin: false, reqGlobalAdmin: false }, false));

// Exports only the handlers
exports.handlers = handlers;
