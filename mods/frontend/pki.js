/*
 * PKIs Management Functions
 * Copyright (c) 2019 Massimiliano Pala and OpenCA Labs
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
const pkiDirName = OCApath.pki;


                        // ==============
                        // Initialization
                        // ==============


// Loads the CA backends
if (OCApkis == null) OCApkis = { "queue": { } };

// Loading the ca.d/ directory
OCAtools.loadJsonDir(pkiDirName, "pki", function $job$init$caCabllack ( data ) {
  if (data == null) throw new ApiError("Cannot load PKI definitions, aborting.");
  OCApkis.queue = data;
  // Let's provide some output for the Audit
  for (var id in OCApkis.queue) {
    // Gets the CA object
    var myPki = OCApkis.queue[id];
    // Adds the Logging information
    OCAaudit.server.add("Loaded PKI configuration for [id: {0}]".format(myPki.id));
    // Setup the General Audit
    /*
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
    */
  }
});


                        // =======================
                        // API Handlers [/pki/...]
                        // =======================


// Registers a new PKI
handlers.push(
  getHandler({ method: "post", path: "/pki",
    func: function OCA$pki$create (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  } , { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// Approves a new Organization
handlers.push(
  getHandler({ method: "get", path: "/pki/:id/approve",
    func: function OCA$pki$approve (req, res, ctx) {
      console.log("Params: " + JSON.strigify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// enables a registered PKI
handlers.push(
  getHandler({ method: "get", path: "/pki/:id/enable",
    func: function OCA$pki$enable (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// disables a registered PKI
handlers.push(
  getHandler({ method: "get", path: "/pki/:id/disable",
    func: function OCA$pki$disable (req, res) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// lists registered organizations
handlers.push(
  getHandler({ method: "get", path: "/pki", 
    func: function OCA$pki$list (req, res, ctx) {

      // Local Variable for the list of organizations
      var orgList = [];

      // Cycle through the Organizations and generates a short list
      for (i in OCAcnf.orgs) {

        // Must check if the user is enabled for the organization
        // (always shows up for global administrators)
        console.log("[DEBUG::%s] Missing Checks for Global Admins and Users", "OCA$orgs$listOrgs");

        // Adds the details to the list
        orgList.push({ "id" : i,
                       "name" : OCAcnf.pki[i].name,
                       "description" : OCAcnf.pki[i].description });
      }

      // Generates a list of all companies and return it as a JSON array
      ctx.msg.body(orgList);

      // Sets the HTTP return code
      res.json(ctx.msg);
      return;
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// retrieves a specific organization
handlers.push(
  getHandler({ method: "get", path: "/pki/:id",
    func: function OCA$pki$get (req, res, ctx) {

      // Local Shortcut
      var pkId = req.params.id;

      // Input Checking
      if (pkId == null || OCAcnf.pkis[pkId] == null) {
        ctx.msg.err(new OCAErr(-1, "PKI Id is Malformed"), req);
        res.status(500).res.json(ctx.msg);
        return;
      }

      // Must check if the user is enabled for the organization
      // (always shows up for global administrators)
      console.log("[DEBUG::%s] Missing Checks for Global Admins and Users", "OCA$orgs$listOrgs");

      // Gets a copy of the organization
      var pki = OCAtools.deepCopy(OCAcnf.pkis[pkId]);

      // Sanitizes the info that is not needed
      delete pki.users;
      delete pki.isAdminOrg;

      // DEBUG
      console.log("Original Object:")
      console.dir(OCAcnf.pkis[pkId], 4, true);

      console.log("\nCloned Object:")
      console.dir(pki, 4, true);

      // Sends the response
      res.json(pki);
      return;
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: false }, true)
);

// updates the value of a specific pki
handlers.push(
  getHandler({ method: "put", path: "/pki/:id",
    func: function OCA$pki$update (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: true, reqGlobalAdmin: false }, true)
);

// Exports only the handlers
exports.handlers = handlers;
