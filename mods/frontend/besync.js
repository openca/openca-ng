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


// The Backend Posts to the Frontend its configuration
// for the Queue initialization for the Backend
handlers.push(
  getHandler({ method: "post",
               path: "/be/conf", func: function user$creation (req, res, ctx) {

    // console.log("DEBUG: REQ BODY", req.body);
    // console.dir(req.body);

    // Let's Build the Message
    var reqMsg = new OCAMsg(req.body);

}}, { login: false, reqAdmin: false, reqGlobalAdmin: false }, true));


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
    res.json({ "req" : req });

}}, { login: true, reqAdmin: false, reqGlobalAdmin: false }, true));


                     // ======================================
                     // Backend Queue Management Functionality
                     // ======================================


// Lists the items on the queue
handlers.push(
  getHandler({ method: "get",
               path: "/be/queue", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));

// Gets the next item on the queue
handlers.push(
  getHandler({ method: "get",
               path: "/be/queue/process", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));

// Updates the current (next) item on the queue
handlers.push(
  getHandler({ method: "post",
               path: "/be/queue/reject", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));

// Updates the current (next) item on the queue
handlers.push(
  getHandler({ method: "post",
               path: "/be/queue/update", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));

// Updates the current (next) item on the queue
handlers.push(
  getHandler({ method: "post",
               path: "/be/queue/abort", func: function (req, res, ctx) {
    console.log("Params: " + JSON.stringify(req.params));
    res.json({ "req" : req });
}}, { login: true, reqAdmin: true, reqGlobalAdmin: false }, false));


// Exports only the handlers
exports.handlers = handlers;
