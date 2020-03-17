/*
 * Front-End Synchronization Functions
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


// Creates a new user
handlers.push(
  getHandler({ method: "post",
               path: "/sync/usr", func: function user$creation (req, res, ctx) {

    // console.log("DEBUG: REQ BODY", req.body);
    // console.dir(req.body);

    // Let's Build the Message
    var reqMsg = new OCAMsg(req.body);

}}, { login: false, reqAdmin: false, reqGlobalAdmin: false }, true));

// Lists the local users
handlers.push(
  getHandler({ method: "get",
               path: "/sync/usr", func: function User$list (req, res, ctx) {

    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });

}}, { login: true, reqAdmin: false, reqGlobalAdmin: false }, true));

// Delete an existing user
handlers.push(
  getHandler({ method: "post",
               path: "/usr/:id/remove", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));


// Exports only the handlers
exports.handlers = handlers;
