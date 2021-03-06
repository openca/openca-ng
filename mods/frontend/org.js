/*
 * Login Functions
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
const orgDirName = OCApath.org;


                        // ==============
                        // Initialization
                        // ==============


// Loads the CA backends
if (OCAorgs == null) OCAorgs = { "queue": { } };

// Loading the ca.d/ directory
OCAtools.loadJsonDir(orgDirName, "org", function $job$init$orgCabllack ( data ) {
  if (data == null) throw new ApiError("Cannot load Organization definitions, aborting.");
  OCAorgs.queue = data;
  // Let's provide some output for the Audit
  for (var id in OCAorgs.queue) {
    // Gets the CA object
    var myOrg = OCAorgs.queue[id];
    // Adds the Logging information
    OCAaudit.server.add("Loaded Organization configuration for [id: {0}]".format(myOrg.id));
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
                        // API Handlers [/org/...]
                        // =======================


// Registers a new Organization
handlers.push(
  getHandler({ method: "post", path: "/org",
    func: function OCA$org$create (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  } , { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// Approves a new Organization
handlers.push(
  getHandler({ method: "get", path: "/org/:id/approve",
    func: function OCA$org$approve (req, res, ctx) {
      console.log("Params: " + JSON.strigify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// enables a registered Organization
handlers.push(
  getHandler({ method: "get", path: "/org/:id/enable",
    func: function OCA$org$enable (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// disables a registered Organization
handlers.push(
  getHandler({ method: "get", path: "/org/:id/disable",
    func: function OCA$org$disable (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// lists registered organizations
handlers.push(
  getHandler({ method: "get", path: "/org", 
    func: function OCA$org$list(req, res, ctx) {

      // Local Variable for the list of organizations
      var orgList = [];

      // Cycle through the Organizations and generates a short list
      for (i in OCAcnf.orgs) {

        // Adds the details to the list
        orgList.push({ "id" : i,
                       "name" : OCAcnf.orgs[i].name,
                       "description" : OCAcnf.orgs[i].description });
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
  getHandler({ method: "get", path: "/org/:id",
    func: function OCA$org$get (req, res, ctx) {

      // Local Shortcut
      var orgId = req.params.id;

      // Input Checking
      if (orgId == null || OCAcnf.orgs[orgId] == null) {
        ctx.msg.err(new OCAErr(-1, "Organization Id is Malformed"), req);
        res.status(500).res.json(ctx.msg);
        return;
      }

      // Gets a copy of the organization
      var org = OCAtools.deepCopy(OCAcnf.orgs[orgId]);

      // Sanitizes the info that is not needed
      delete org.users;
      delete org.isAdminOrg;

      // DEBUG
      console.log("Original Object:")
      console.dir(OCAcnf.orgs[orgId], 4, true);

      console.log("\nCloned Object:")
      console.dir(org, 4, true);

      // Sends the response
      res.json(org);
      return;
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: false }, true)
);

// updates the value of a specific company
handlers.push(
  getHandler({ method: "put", path: "/org/:id",
    func: function OCA$org$update (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: false }, true)
);


// Exports only the handlers
exports.handlers = handlers;
