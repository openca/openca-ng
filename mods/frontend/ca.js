/*
 * CAs Management Functions
 * Copyright (c) 2019 Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

// This Object
const me = this;
const handlers = [];

// Shortcut
var getHandler = OCAtools.getHandler;

// Registers a new CA
handlers.push(
  getHandler({ method: "post", path: "/ca",
    func: function OCA$cas$create (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  } , { login: true, reqAdmin: true, reqGlobalAdmin: true }, true)
);

// Approves a new CA
handlers.push(
  getHandler({ method: "get", path: "/ca/:id/approve",
    func: function OCA$cas$approve (req, res, ctx) {
      console.log("Params: " + JSON.strigify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true)
);

// Enables a registered CA
handlers.push(
  getHandler({ method: "get", path: "/ca/:id/enable",
    func: function OCA$cas$enable (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: true, reqGlobalAdmin: false }, true)
);

// disables a registered PKI
handlers.push(
  getHandler({ method: "get", path: "/ca/:id/disable",
    func: function OCA$cas$disable (req, res, ctx) {
      console.log("Params: " + JSON.stringify(req.params));
      res.json({ "req" : req });
    }
  }, { login: true, reqAdmin: true, reqGlobalAdmin: true }, true)
);

// lists registered organizations
handlers.push(
  getHandler({ method: "get", path: "/ca", 
    func: function OCA$cas$list (req, res, ctx) {

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
