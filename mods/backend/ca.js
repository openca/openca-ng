/*
 * Jobs Functions - Submissions
 * Copyright (c) 2016 Massimiliano Pala and Teza Realty
 * All Rights Reserved
 */

// This Object
const me = this;
const handlers = [];

// Crypto and FileSystem Requirements
const crypto = require("crypto");
const fs = require("fs");

// Shortcut
const getHandler = OCAtools.getHandler;

// Directory Names
const dataDir    = OCApath.data;
const jobDirName = OCApath.job;
const ordDirName = OCApath.order;
const caDirName  = OCApath.ca;
const cspDirName = OCApath.csp;

                        // ==============
                        // Initialization
                        // ==============


// Loads the CA backends
if (OCAcas == null) OCAcas = { "queue" : { } };

// Loading the ca.d/ directory
OCAtools.loadJsonDir(caDirName, "ca", function $job$init$caCabllack ( data ) {
  if (data == null) throw new ApiError("Cannot load CA definitions, aborting.");
  OCAcas.queue = data;
  // Let's provide some output for the Audit
  for (var id in OCAcas.queue) {
    // Gets the CA object
    var myCA = OCAcas.queue[id];
    // Adds the Logging information
    OCAaudit.server.add("Loaded CA configuration for [id: {0}]".format(myCA.id));
    // Setup the General Audit
    const caAuditSubDirName = caDirName + "/ca-" + myCA.id + "/audit.d";
    myCA.log  = new OCAaudit.init(caAuditSubDirName, { "key": OCAcnf.audit.key, "prefix": myCA.id });
    // Now we want to load the key (if present)
    const caKeyFileName = caDirName + "/ca-" + myCA.id + "/key-" + myCA.id + ".json";
    // Checks if the file already exists
    if (fs.existsSync(caKeyFileName)) {
      // Loads the data into memory
      var data = fs.readFileSync(caKeyFileName);
      // Use only validated data (third parameter omitted - type.d directory)
      if ((key = OCAtools.checkObjFields(JSON.parse(data), "key")) == null) {
        OCAaudit.server.add("ERROR: Cannot load key definition for CA [{0}] from [{0}]".format(myCA.id, caKeyFileName));
        myCA.log.add("Rejected CA [{0}] malformed KEY definition data [file: {1}]".format(myCA.id, caKeyFileName));
      } else {
        OCAaudit.server.add("Loaded Key definition for CA [{0}] from [file: {1}]".format(myCA.id, caKeyFileName));
        myCA.log.add("Loaded Key definition for CA [{0}] from [file: {1}]".format(myCA.id, caKeyFileName));
        myCA.key = key;
      }
    }
  }
});

// Loading the csp.d/ directory
OCAtools.loadJsonDir(cspDirName, "csp", function $job$init$cspCabllack ( data ) {
  if (data == null) throw new ApiError("Cannot load Crypto Service Providers (CSP) definitions, aborting.");
  OCAcsps.queue = data;
  // Let's provide some output for the Audit
  for (var id in OCAcsps.queue) {
    var csp = OCAcsps.queue[id];
    // Let's see if initialization is needed
    for (var idx = 0; csp.init != null && idx < csp.init.length; idx++) {
      // Executes the command
      OCAtools.execCmd(csp.init[idx], (err, data) => {
        if (err) {
          OCAaudit.server.add("Error while initializing CSP [%s], disabling it.".format(csp.id));
          csp.enabled = false;
        }
      });
    }
    OCAaudit.server.add("Loaded CSP configuration for [id: {0}]".format(id));
  }
});


                        // =======================
                        // API Handlers [/ca/...]
                        // =======================


// Login
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/ca", func: function Backend$Ca$Submit (req, res, ctx) {

    // Order to be stored
    var ca = {};

    // Let's Build the Message
    var reqMsg = new OCAMsg(req.body);
    if (!reqMsg || !reqMsg.body()) {
        ctx.msg.err(new OCAErr(303, "Request Malformed"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // Debugging
    OCAaudit.server.add("Client [{0}] Submitted a new CA.".format(ctx.sessionData.id));

    try {

        // Check we get an order object.
        var data = JSON.parse(reqMsg.body());
        if (data == null) {
          OCAaudit.server.add("Client [{0}] new CA definition cannot be parsed correctly, rejected.".format(ctx.sessionData.id));
          throw new ApiError("Unexpected Internal Error");
        }

        // Checks for any active jobs
        if (OCAcas.queue === null) OCAcas.queue = { };

        // Checks if we have the same order already
        if (typeof data.id === "string" && OCAcas.queue[data.id] != null) {
            OCAdebug("CA ['%s'] was already submitted, rejecting it.", data.id);
            OCAaudit.server.add("Rejected duplicated CA Submission [{0}] [client: {1}]".format(data.id, ctx.sessionData.id));
            ctx.msg.err(new OCAErr(503, "CA ['" + data.id + "'] was already submitted, rejected."));
            OCAtools.returnError(req, res, ctx);
            return;
        }

        // Checks the Id is in the right format
        if (data.id.replace(/^\.|[\,\/\$\:\#\!\@\%\^\&\*\(\)\[\]\'\"\|\=\\\{\}\<\>]+/g, "") != data.id) {
          OCAaudit.server.add("Malformed CA Id [{0}], Rejected. [client: {1}]".format(data.id, ctx.sessionData.id));
          ctx.msg.err(new OCAErr(503, "CA Id ['" + data.id + "'] is incorrectly formatted, rejected.", 
            "Please Avoid => , / $ : # ! @ % ^ & * ( ) [ ] { } < > \' \" | = \\ )."));
          OCAtools.returnError(req, res, ctx);
          return;
        }

        // Use only validated data (third parameter omitted - type.d directory)
        if ((ca = OCAtools.checkObjFields(data, "ca")) == null) {
          OCAaudit.server.add("Rejected malformed CA definition data [{0}] [client: {1}]".format(data.id, ctx.sessionData.id));
          throw new ApiError("Cannot parse the order data.");
        }

        // Auxillary variables
        const caFileName = caDirName + "/ca-" + ca.id + ".json";

        // Let's generate a new JOB object
        var myCA = { 
          "id"          : ca.id,
          "issuerId"    : ca.issuerId,
          "isRoot"      : ( ca.id == ca.issuerId ? true : false),
          "fileName"    : caFileName,
          "submittedOn" : new Date(),
          "pki"         : ca.pki,
          "desc"        : ca.desc,
          "createdOn"   : undefined,
          "errorOn"     : undefined,
          "enabled"     : false,
          "history"     : []
        };

        // Stores the job in the jobs directory
        fs.writeFileSync(caFileName, JSON.stringify(myCA));
        if (!fs.existsSync(caFileName)) {
          OCAaudit.server.add("Internal Error while saving the CA definition file [{0}], failed.".format(myCA.filename));
          throw new ApiError("Cannot save the CA definition file in ['" + myCA.fileName + "']");
        }

        // Let's add some history
        // OCAtools.addHistory( myCA, true,
        //    "CA [" + myCA.id + "] definition file was successfully saved [" + ctx.sessionId + "]");

        // Creates the Sub Directory Structure for the CA
        const caSubDirName = caDirName + "/ca-" + ca.id;
        if (!fs.existsSync(caSubDirName)) {
          fs.mkdirSync(caSubDirName, 0700);
        }

        // Creates the Sub Directory for the Certificates in the CA
        const caCertSubDirName = caSubDirName + "/cert.d";
        if (!fs.existsSync(caCertSubDirName)) {
          fs.mkdirSync(caCertSubDirName, 0700);
        }

        // Creates the Sub Directory for Audit
        const caAuditSubDirName = caSubDirName + "/audit.d";
        if (!fs.existsSync(caAuditSubDirName)) {
          fs.mkdirSync(caAuditSubDirName, 0700);
        }

        // Starts the new Logging Facility
        myCA.log = new OCAaudit.init(caAuditSubDirName, { key: OCAcnf.audit.key, prefix: myCA.id });

        // Let's add a first log
        myCA.log.add("CA [{0}] created by [{1}]".format(myCA.id, ctx.sessionData.id));

        // Adds the Order to the Queue
        OCAcas.queue[myCA.id] = myCA;


    } catch (e) {
        OCAdebug("[Exception] %s", e);
        ctx.msg.err(new OCAErr(303, "Request Malformed"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // Audit
    OCAaudit.server.add("Client [{0}] Submission completed successfully [{1}]".format(ctx.sessionData.id, data.id));

    // Let's return not-implemented, yet
    ctx.msg.body({ code: "200", status: "Success. Your New CA [" + 
        myCA.id + "] was successfully created." });
    res.json(ctx.msg);
    return;

  } // End of getHandler() call

}, { certAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the List of Existing CAs
handlers.push(
  getHandler({ method: "get",
               path: "/ca", func: function Backend$Ca$GetList (req, res, ctx) {

    // Let's Build the Message
    var respData = [ ];

    // While we have a valid ID, let's list the jobs
    for (var j in OCAcas.queue) {
      if (OCAcas.queue[j] != null) {
        respData.push({ 
            id: j,
            pki: OCAcas.queue[j].submittedOn,
            descr: OCAcas.queue[j].completedOn,
            enabled: OCAcas.queue[j].enabled,
            status: OCAcas.queue[j].status
        });
      }
    }

    // The Body of the message is the array of jobs
    res.json( respData );

    // OCAdebug("[*] OCAjobs.first = {0}".format(OCAjobs.first));
    // OCAdebug(OCAtools.sprintf("[*] OCAjobs.first = {0}",OCAjobs.first));
    // OCAdebug("OCAjobs.last = %s", OCAjobs.last);
    // OCAdebug("OCAjobs.active = %s", OCAjobs.active);

    // OCAdebug("OCAjobs.queue Object:");
    // console.log(OCAjobs.queue, 4, true);
    // OCAdebug("\n\n");

    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",
               path: "/ca/:id", func: function Backend$Ca$GetFullCa (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAcas.queue[id] == null) {
      ctx.msg.err(new OCAErr(404, "Missing or invalid CA Id"));
      OCAtools.returnError(req, res, ctx);
      return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAcas.queue[id]) {
      // Cannot be canceled, it is already processing
      ctx.msg.err(new OCAErr(404, "Wrong or missing CA Id ['" + id + "']."));
      res.json(ctx.msg);
      return;
    }

    // Sets the Body of the response
    ctx.msg.body({ 
      "id": id,
      "issuerId" : OCAcas.queue[id].issuerId,
      "pki":  OCAcas.queue[id].pki,
      "desc": OCAcas.queue[id].desc,
      "enabled": OCAcas.queue[id].enabled,
      "isRoot" : OCAcas.queue[id].isRoot,
      "status": OCAcas.queue[id].status
    });

    // Sets the status code and the json for the message
    res.status(200).json(ctx.msg);

    // All Done
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",
               path: "/ca/:id/enable", func: function Backend$Ca$GetFullCa (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAcas.queue[id] == null) {
      ctx.msg.err(new OCAErr(404, "Missing or invalid CA Id"));
      OCAtools.returnError(req, res, ctx);
      return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAcas.queue[id]) {
      // Cannot be canceled, it is already processing
      ctx.msg.err(new OCAErr(404, "Wrong or missing CA Id ['" + id + "']."));
      return OCAtools.returnError(req, res, ctx);
    }

    // Checks if the CA is already enabled
    if (OCAcas.queue[id].enabled == true) {
        ctx.msg.err(new OCAErr(503, "CA [{0}] is already enabled.".format(id)));
        return OCAtools.returnError(req, res, ctx);
    }

    // If not already enabled, let's enable it
    if (OCAtools.enableCA(OCAcas.queue[id]) != true) {
        ctx.msg.err(new OCAErr(503, "Error while enabling CA [{0}]".format(id)));
        return OCAtools.returnError(req, res, ctx);
    }

    // All Done
    ctx.msg.body("CA enabled successfully");
    res.status(200).json(ctx.msg);

    // All Done
    return;

}}, { clientCertAuth: true, reqAdmin: true, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",
               path: "/ca/:id/disable", func: function Backend$Ca$GetFullCa (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAcas.queue[id] == null) {
      ctx.msg.err(new OCAErr(404, "Missing or invalid CA Id"));
      OCAtools.returnError(req, res, ctx);
      return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAcas.queue[id]) {
      // Cannot be canceled, it is already processing
      ctx.msg.err(new OCAErr(404, "Wrong or missing CA Id ['" + id + "']."));
      return OCAtools.returnError(req, res, ctx);
    }

    // Checks if the CA is already enabled
    if (OCAcas.queue[id].disabled == true) {
        ctx.msg.err(new OCAErr(503, "CA [{0}] is already disabled.".format(id)));
        return OCAtools.returnError(req, res, ctx);
    }

    // If not already enabled, let's enable it
    if (OCAtools.disableCA(OCAcas.queue[id]) != true) {
        ctx.msg.err(new OCAErr(503, "Error while disabling CA [{0}]".format(id)));
        return OCAtools.returnError(req, res, ctx);
    }

    // Checks if we have a job scheduled for this CA
    for (var jobId in OCAjobs.queue) {
        if (OCAjobs.queue[jobId].caId == id) {
            ctx.msg.err(new OCAErr(503, "CA [{0}] has queued jobs, disabling is forbidden.".format(id)));
        }
    }

    // All Done
    ctx.msg.body("CA disabled successfully");
    res.status(200).json(ctx.msg);

    // All Done
    return;

}}, { clientCertAuth: true, reqAdmin: true, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",
               path: "/ca/:id/orders", func: function Backend$Ca$GetFullCa (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // The return list
    var aArray = [];

    // Checks the Input
    if (id == null || id == "" || OCAcas.queue[id] == null) {
      ctx.msg.err(new OCAErr(404, "Missing or invalid CA Id"));
      OCAtools.returnError(req, res, ctx);
      return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAcas.queue[id]) {
      // Cannot be canceled, it is already processing
      ctx.msg.err(new OCAErr(404, "Wrong or missing CA Id ['" + id + "']."));
      return OCAtools.returnError(req, res, ctx);
    }

    // Checks if the CA is already enabled
    if (OCAcas.queue[id].disabled == true) {
        ctx.msg.err(new OCAErr(503, "CA [{0}] is already disabled.".format(id)));
        return OCAtools.returnError(req, res, ctx);
    }

    // Checks if we have a job scheduled for this CA
    for (var jobId in OCAjobs.queue) {
        if (OCAjobs.queue[jobId].caId == id) {
            aArray.push(jobId);
        }
    }

    // All Done
    ctx.msg.body({ "caId" : id, "orders" : aArray });
    res.status(200).json(ctx.msg);

    // All Done
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// Login
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/ca/:id/key", func: function Backend$Ca$Key$Submit (req, res, ctx) {

    // Order to be stored
    var key = {};
    var id = req.params.id;

    // Let's Build the Message
    var reqMsg = new OCAMsg(req.body);
    if (!reqMsg || !reqMsg.body()) {
        ctx.msg.err(new OCAErr(303, "Request Malformed"));
        return OCAtools.returnError(req, res, ctx);
    }

    // Debugging
    OCAaudit.server.add("Client [{0}] Submitted a new Key for CA [{1}].".format(ctx.sessionData.id, id));

    // Use only validated data (third parameter omitted - type.d directory)
    if (OCAcas.queue[id] == null || OCAcas.queue[id].enabled == true) {
      OCAaudit.server.add("Rejected new Key submmission for CA [{0}] (not available) [client: {1}]".format(id, ctx.sessionData.id));
      ctx.msg.err(new OCAErr(404, "CA [{0}] is {1} on this host, key rejected."
            .format(id,(OCAcas.queue[id] == null ? "not configured" : "already enabled"))));
      return OCAtools.returnError(req, res, ctx);
    }

    // We need to execute the key generation
    var myCA = OCAcas.queue[id];

    // Check we get an order object.
    var data = JSON.parse(reqMsg.body());
    if (data == null) {
      myCA.log.add("Rejected (cannot parse) New Key Submission by Client [{0}].".format(ctx.sessionData.id));
      ctx.msg.err(new OCAErr(500, "Key Definition for CA [{0}] is Malformed, rejected.".format(id)));
      return OCAtools.returnError(req, res, ctx);
    }

    // Use only validated data (third parameter omitted - type.d directory)
    if ((key = OCAtools.checkObjFields(data, "key")) == null) {
      myCA.log.add("Rejected malformed KEY definition data [client: {1}]".format(ctx.sessionData.id));
      ctx.msg.err(new OCAErr(500, "Rejected malformed KEY definition data, failed."));
      return OCAtools.returnError(req, res, ctx);
    }

    // Let's generate a new JOB object
    var myKey = {
      "type" : key.type,
      "algorithm" : {
        "id" : key.algorithm.id,
        "params" : { 
            "curve" : key.algorithm.params.curve,
            "bits" : key.algorithm.params.bits
        }
      }
    };

    // Checks that the crypto provider is enabled
    if (OCAcsps.queue[myKey.type] == null) {
      myCA.log.add("Rejected (err: crypto provider not found) Key Submission by [{0}], Crypto Provider [{1}] not found".format(myKey.type));
      ctx.msg.err(new OCAErr(404, "Crypto Provider [{0}] not present on this host, failed.".format(myKey.type)));
      OCAtools.returnError(req, res, ctx);
      return;
    }

    // Let's check the existance of the key
    if (myCA.key != null) {
      var errMsg = "Rejected (err: Key Already Configured) Key Submission for CA [{0}] (type: {1})".format(myCA.id, myKey.type);
      // If the key definition is already there
      myCA.log.add(errMsg);
      // we need to remove it
      ctx.msg.err(new OCAErr(503, errMsg));
      OCAtools.returnError(req, res, ctx);
      return;
    }

    // Generate/Import/Unwrap the key. If no errors are
    // detected, then the function returns the augmented
    // key configuration, otherwise it will return null
    OCAtools.newCaKey(myCA, myKey, function ca$KeyGen$ExecCallback(err, data) {

      try {

        // Checks the error case first
        if (err) {
          // Setup the description message for debugging and auditing
          var errDesc = "Error while Generating/Importing/Unwrapping key for CA [{0}] of type [{1}] ({2})"
            .format(myCA.id, myKey.type, JSON.stringify(err));
          // Developer's Info
          OCAdebug(errDesc);
          // Audit Info
          OCAaudit.server.add(errDesc);
          // Setup the Error Message
          if (err.code >= 500) {
            // If the error code is ours, then copy the description
            ctx.msg.err(new OCAErr(501, err.__desc));
          } else {
            // If the error code is from the exec command, send a generic error msg
            ctx.msg.err(new OCAErr(501, "Error while processing the request, failed."));
          }
          OCAtools.returnError(req, res, ctx);
          // All Done
          return;
        }

        // Sets the Value of the Key as returned by the command
        myKey.value = data;

        // We need to save the key definition
        const caKeyFileName = OCApath.ca + "/ca-" + myCA.id + "/key-" + myCA.id + ".json";
        // Checks that the file does not already exists
        if (fs.existsSync(caKeyFileName)) {
          ctx.msg.err(new OCAErr(503, "Private Key for CA [{0}] already exists, failed.".format(myCA.id)));
          OCAtools.returnError(req, res, ctx);
          return;
        }
        // Writes the Key definition and checks the operation was successful
        fs.writeFileSync(caKeyFileName, JSON.stringify(myKey));
        if (!fs.existsSync(caKeyFileName)) {
          ctx.msg.err(new OCAErr(503, "Failed to persist key definition for CA [{0}], failed.".format(myCA.id)));
          OCAtools.returnError(req, res, ctx);
          return;
        }

        // Adds the key to the CA's definition
        myCA.key = myKey;

        // Let's add some history
        // OCAtools.addHistory(myCA, true, "New Key processed for CA by [{0}]".format(ctx.sessionId));
        myCA.log.add("Successful New Key Submission by [{0}]".format(ctx.sessionData.id));

        // Audit
        OCAaudit.server.add("Client [{0}] Submission (Key) completed successfully for CA [{1}]".format(ctx.sessionData.id, myCA.id));

        // Let's return not-implemented, yet
        ctx.msg.body({ code: "200", status: "Key submission for CA [" + 
            myCA.id + "] was successfully processed." });
        res.json(ctx.msg);

      } catch (e) {
        OCAdebug("[Exception] %s", e);
        ctx.msg.err(new OCAErr(303, "Request Malformed"));
        return OCAtools.returnError(req, res, ctx);
      }

      return;
    });

    return;

  } // End of getHandler() call

}, { certAuth: true, reqAdmin: false, reqAudit: false }, true));

// Exports only the handlers
exports.handlers = handlers;
