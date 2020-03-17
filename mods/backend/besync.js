/*
 * Backend Synchronization Functions (offline Backends Support)
 * Copyright (c) 2016 Massimiliano Pala and Teza Realty
 * All Rights Reserved
 */

// This Object
const me = this;
const handlers = [];

// Crypto Requirements
const crypto = require("crypto");

// Shortcut
const getHandler = OCAtools.getHandler;


                        // =======================
                        // API Handlers [/usr/...]
                        // =======================

// Lists the local CAs
handlers.push(
  getHandler({ method: "get",
               path: "/sync/ca", func: function User$list (req, res, ctx) {

    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });

}}, { login: true, reqAdmin: false, reqGlobalAdmin: false }, true));

// Delete an existing user
handlers.push(
  getHandler({ method: "get",
               path: "/sync/ord", func: function (req, res, ctx) {

    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
    
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));


// Exports only the handlers
exports.handlers = handlers;
