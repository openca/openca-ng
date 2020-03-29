/*
 * Back-End Synchronization Functions
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



                     // ======================================
                     // Backend Posting at Initialization Time
                     // ======================================

// Gets the List of configured backends on the Frontend
handlers.push(
  getHandler({ method: "post",
               path: "/be", func: function User$list (req, res, ctx) {

    // This function shall check if an existing configuration for the
    // backend already exists, and, if not, it creates a new one and
    // spawns a new OCAordq manager for the specific backend
    //
    // If the configuration of the backend exists already, it does
    // update it on disk. The backend configuration also contains the
    // list of available CAs.
    console.log("Params: " + JSON.stringify(req.params));

    // Debug - Returns an error
    ctx.msg.err(new OCAErr(-1, "Test Error"));
    OCAtools.returnError(req, res, ctx);
    // res.json(ctx.msg);

}}, { login: true, reqAdmin: false, reqGlobalAdmin: true }, true));


                     // ======================================
                     // Backend Queue Management Functionality
                     // ======================================


// Gets the next item on the queue
handlers.push(
  getHandler({ method: "get",
               path: "/be", func: function (req, res, ctx) {
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    // console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : "success" });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: true }, false));

// Updates the current (next) item on the queue
handlers.push(
  getHandler({ method: "post",
               path: "/be/:id/:verb", func: function (req, res, ctx) {
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    console.log(">>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<");
    // console.log("[ id: " + req.params.id + ", verb: " + req.params.verb + "]");
    res.json({ "req" : "success" });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: true }, false));

// Exports only the handlers
exports.handlers = handlers;
