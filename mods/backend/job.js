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


                        // ==============
                        // Initialization
                        // ==============


// Loads the CA backends
if (OCAjobs == null) OCAjobs = { };

// Loading the job.d/ directory
OCAtools.loadJsonDir(jobDirName, "job", function $job$init$caCabllack (data) {
  // Checks we have the data
  if (data == null) throw new ApiError("Cannot load CA definitions, aborting.");

  // Assigns the data to the jobs queue
  OCAjobs.queue = data;
  
  // We build the 'next' links in the double linked list in memory
  // from the 'prev' links only.
  for (var id in OCAjobs.queue) {
    // Shortcut to the Job object
    var j = OCAjobs.queue[id];
    // Checks if the node has a the previous one
    if (!j.prev) {
        // The node is the first one
        OCAjobs.first = j.id;
    } else {
        // Let's set the 'next' to the id of
        // the current node
        if (OCAjobs.queue[j.prev] != null) OCAjobs.queue[j.prev].next = j.id;
    }
    // Checks if the job is active
    if (j.active == true) OCAjobs.active = j.id;
  }

  // Now we need to find the last element, we start
  // from the first one
  var j = OCAjobs.first;

  // Go through all of the elements
  while (j != null && OCAjobs.queue[j] != null) {
    // If the element's next has not been set,
    // then it must be the last element
    if (!OCAjobs.queue[j].next) {
      // Assign the last element id
      OCAjobs.last = j;
      // Exits from the loop
      break;
    }
    // Go to the next leaf
    j = OCAjobs.queue[j].next;
  }

});

// Loading the csp.d/ directory
OCAtools.loadJsonDir(ordDirName, "order", function $job$init$ordCabllack ( data ) {
  // Checks the data parameter
  if (data == null) throw new ApiError("Cannot load orders definitions, aborting.");
  OCAorders.queue = data;
  // Let's provide some output for the Audit
  for (var id in OCAorders.queue) {
    // Shortcut to the specific order definition
    const myOrd = OCAorders.queue[id];
    // Sets the directory name
    const ordAuditSubDirName = ordDirName + "/ord-" + myOrd.id + "/audit.d";
    // Initializes the log facility
    myOrd.log  = new OCAaudit.init(ordAuditSubDirName, 
        { "key": OCAcnf.audit.key, "prefix": myOrd.id });
  }
});


                        // ===========================================
                        // Login, Register, and Logout functionalities
                        // ===========================================

// Login
//
// AuthParams = { login: false }
handlers.push(
  getHandler({ method: "post",
               path: "/j", func: function Order$Submit (req, res, ctx) {

    // Order to be stored
    var order = {};
    var myJob = {};

    // Index for the last entry (we only append)
    var idx   = undefined;

    // Let's Build the Message
    var reqMsg = new OCAMsg(req.body);
    if (!reqMsg || !reqMsg.body()) {
        ctx.msg.err(new OCAErr(303, "Request Malformed"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // Debugging
    OCAaudit.server.add("Client [{0}] Submitted a new order request.".format(ctx.sessionData.id));

    try {

        // Check we get an order object.
        var data = JSON.parse(reqMsg.body());
        if (data == null) {
          OCAaudit.server.add("Client [{0}] request cannot be parsed correctly, rejected.".format(ctx.sessionData.id));
          throw new ApiError("Unexpected Internal Error");
        }

        // Checks for any active jobs
        if (OCAjobs.queue === null) OCAjobs.queue = { };

        // Checks if we have the same order already
        if (typeof data.id === "string" && OCAjobs.queue[data.id] != null) {
            OCAdebug("Order ['%s'] was already submitted, rejecting the job.", data.id);
            OCAaudit.server.add("Duplicate Order Submission [{0}]. Rejected. [client: {1}]".format(data.id, ctx.sessionData.id));
            ctx.msg.err(new OCAErr(503, "Order ['" + data.id + "'] was already submitted, rejected."));
            return OCAtools.returnError(req, res, ctx);
        }

        // Checks the Id is in the right format
        if (data.id.replace(/^\.|[\,\/\$\:\#\!\@\%\^\&\*\(\)\[\]\'\"\|\=\\\{\}\<\>]+/g, "") != data.id) {
          OCAaudit.server.add("Malformed Order Id [{0}], Rejected. [client: {1}]".format(data.id, ctx.sessionData.id));
          ctx.msg.err(new OCAErr(503, "Order ID ['" + data.id + "'] is incorrectly formatted, rejected.", 
            "Please Avoid => . , / $ : # ! @ % ^ & * ( ) [ ] { } < > \' \" | = \\ )."));
          return OCAtools.returnError(req, res, ctx);
        }

        // Use only validated data (third parameter omitted - type.d directory)
        if ((order = OCAtools.checkObjFields(data, "order")) == null) {
          OCAaudit.server.add("Rejected malformed order data [client: {0}]".format(ctx.sessionData.id));
          ctx.msg.err(new OCAErr(500, "Malformed order data, rejected."));
          return OCAtools.returnError(req, res, ctx);
        }

        // Checks if we have the right CA enabled
        if (OCAcas.queue[order.caId] == null) {
          OCAaudit.server.add("No CA [{0}] is available, order [{1}] is rejected".format(order.caId, order.id));
          ctx.msg.err(new OCAErr(503, "Missing CA ['{0}'], order rejected.".format(order.caId)));
          return OCAtools.returnError( req, res, ctx );
        } else if (OCAcas.queue[order.caId].enabled == false) {
          OCAaudit.server.add("CA [{0}] is disabled, order [{1}] is rejected".format(order.caId, order.id));
          ctx.msg.err(new OCAErr(503, "CA ['{0}] is disabled, order rejected.".format(order.caId)));
          return OCAtools.returnError( req, res, ctx );
        }

        // Auxillary variables
        const ordFileName = ordDirName + "/ord-" + order.id + ".json";
        const jobFileName = jobDirName + "/job-" + order.id + ".json";

        // Let's generate a new JOB object
        var myJob = { 
          "id"          : order.id,
          "caId"        : order.caId,
          "fileName"    : jobFileName,
          "ordFileName" : ordFileName,
          "submittedOn" : new Date(),
          "completedOn" : undefined,
          "errorOn"     : undefined,
          "prev"        : undefined,
          "next"        : undefined,
          "processed"   : [],
          "history"     : []
        };

        // Let's add some history
        // OCAtools.addHistory( myJob, false, "Order [" + order.id +
        //     "] was received from [sha1:" + ctx.sessionId + "]");
        OCAaudit.server.add("Order [{0}] was correctly received from [{1}]"
            .format(order.id, ctx.sessionData.id));

        // Stores the job in the jobs directory
        fs.writeFileSync(ordFileName, JSON.stringify(order));
        if (!fs.existsSync(ordFileName)) {
          OCAaudit.server.add("Internal Error while saving the order file [{0}], Submission Failed.".format(ordFileName));
          throw new ApiError("Cannot save the Order file in ['" + myJob.ordFileName + "']");
        }

        // Directories to be created
        const subDirs = {
          "main" : ordDirName + "/ord-" + order.id,
          "cert" : ordDirName + "/ord-" + order.id + "/cert.d",
          "audit" : ordDirName + "/ord-" + order.id + "/audit.d",
          "req" : ordDirName + "/ord-" + order.id + "/req.d",
          "key" : ordDirName + "/ord-" + order.id + "/key.d"
        };

        // Creates all the sub directories for the order
        for (var i in subDirs) {
          // Builds the Directory Name
          var dirName = subDirs[i];
          // Checks if the directory already exists
          if (!fs.existsSync(dirName)) {
            // Creates the new directory
            fs.mkdirSync(dirName, 0700);
          }
        }

        // Adds the Order to the Orders' Queue
        OCAorders.queue[order.id] = order;
        // Generates a new logging facility for the order
        order.log = new OCAaudit.init(subDirs.audit, { key: OCAcnf.audit.key, prefix: order.id });
        // Let's add a first log
        order.log.add("Order successfully submitted by [{0}]".format(ctx.sessionData.id));
        // Audit
        OCAaudit.server.add("Client [{0}] Submission was correctly received [order: {1}]".format(ctx.sessionData.id, order.id));
        // Adds the Job to the Queue
        OCAjobs.queue[myJob.id] = myJob;
        // If this is not the first element, let's fix
        // the last element's next and this element's prev
        if (OCAjobs.last != null) {
            // Setting the prev link into our new node
            myJob.prev = OCAjobs.last;
            // Setting the next link in the previous last node
            OCAjobs.queue[myJob.prev].next = myJob.id;
            // Setting the last link to the new node
            OCAjobs.last = myJob.id;
        } else {
            // Sets the last link to the new node
            OCAjobs.last = myJob.id;
        }

        // Sets the 'first' link, if missing
        if (OCAjobs.first == null) OCAjobs.first = myJob.id;

        // Let's add some history
        OCAtools.addHistory( myJob, true,
            "Job [" + myJob.id + "] was added to the queue after [" + 
            myJob.prev + "] by [" + ctx.sessionData.id + "]");

        // Audit
        OCAaudit.server.add("Order [{0}] was added to the queue after [{1}]".format(data.id, myJob.prev));

    } catch (e) {
        OCAdebug("[Exception] %s", e);
        ctx.msg.err(new OCAErr(303, "Request Malformed"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // Let's return not-implemented, yet
    ctx.msg.body({ code: "200", status: "Success. Your order [" + 
        myJob.id + "] was added to the queue." });
    res.json(ctx.msg);
    return;

  } // End of getHandler() call

}, { certAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
//
// @Parameters:
//  - none
// 
// @Returns:
//  - The list of queued and active jobs in the queue
handlers.push(
  getHandler({ method: "get",
               path: "/j", func: function Order$GetJobsList (req, res, ctx) {

    // Let's Build the Message
    var respData = [ ];

    // Let's return not-implemented, yet
    // ctx.msg.err(new OCAErr(500, "Method Not Implemented, yet."));
    // OCAtools.returnError(req, res, ctx);
    // return;
    var j = OCAjobs.first;

    // While we have a valid ID, let's list the jobs
    while (j != null && OCAjobs.queue[j] != null) {
        respData.push({ 
            id: j,
            submittedOn: OCAjobs.queue[j].submittedOn,
            completedOn: OCAjobs.queue[j].completedOn,
            errorOn: OCAjobs.queue[j].errorOn,
            prev: OCAjobs.queue[j].prev,
            next: OCAjobs.queue[j].next,
            isNext: (OCAjobs.first == j),
            isActive: (OCAjobs.active == j)
        });
        // Gets the next ID in the queue
        j = OCAjobs.queue[j].next;
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
               path: "/j/:id", func: function Order$GetFullJob (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAjobs.queue[id] == null) {
        ctx.msg.err(new OCAErr(404, "Missing or invalid Job ID"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAjobs.queue[id]) {
        // Cannot be canceled, it is already processing
        ctx.msg.err(new OCAErr(404, "Wrong or missing order ID ['" + id + "']."));
        res.json(ctx.msg);
        return;
    }

    // Sets the Body of the response
    ctx.msg.body({ 
        id: id,
        submittedOn: OCAjobs.queue[id].submittedOn,
        completedOn: OCAjobs.queue[id].completed,
        errorOn: OCAjobs.queue[id].error,
        isNext: (OCAjobs.first == id),
        isActive: (OCAjobs.active == id)
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
               path: "/j/:id/result", func: function Order$Status (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAjobs.queue[id] == null) {
        ctx.msg.err(new OCAErr(404, "Missing or invalid Job ID"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAjobs.queue[id].completed) {
        // Cannot be canceled, it is already processing
        ctx.msg.err(new OCAErr(503, "Job not completed, yet."));
        res.json(ctx.msg);
        return;
    }

    // Sets the Body of the response
    ctx.msg.err(new OCAErr(500, "Method not implemented, yet."));
    res.json(ctx.msg);

    // All Done
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Cancels (or Aborts) an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "delete",
               path: "/j/:id", func: function Order$DeleteJob (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAjobs.queue[id] == null) {
      // Audit Information
      OCAaudit.server.add("Order [{0}] was requested for removal, but it does not exists. [Client: {1}]".format(id, ctx.sessionData.id));
        ctx.msg.err(new OCAErr(404, "Missing or invalid Job ID"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // Shortcut
    var job = OCAjobs.queue[id];

    // Audit Trail
    OCAaudit.server.add("Client [{0}] Requested the removal of Order [{1}].".format(ctx.sessionData.id, id));

    // List of Jobs to be updated on disk
    var jobsToUpdate = { };

    // If the job is active, let's not interrupt it (might change in the future)
    if (job.active == true) {
      // Audit Information
      OCAaudit.server.add("Cannot remove Order [{0}] because it is currently active [Client: {1}]".format(id, ctx.sessionData.id));
      // Cannot be canceled, it is already processing
      ctx.msg.err(new OCAErr(503, "Job already processing, cannot abort."));
      res.json(ctx.msg);
      return;
    }

    // Checks and updates the links for the removal
    if (OCAjobs.first == OCAjobs.last && OCAjobs.last == job.id) {

      // Deleting the last node
      delete OCAjobs.queue[id];
      // Resetting the Queue
      OCAjobs.first = undefined;
      OCAjobs.last = undefined;
      OCAjobs.active = undefined;

    } else if (OCAjobs.first == id) {

      // Updates the first link
      OCAjobs.first = job.next;
      // Clearing the prev link in the new first node
      OCAjobs.queue[OCAjobs.first].prev = undefined;
      // Adds the OCAjobs.first node to the list of nodes to be updated
      jobsToUpdate[OCAjobs.first] = OCAjobs.queue[OCAjobs.first];

    } else if (OCAjobs.last  == id) {

      // Let's check for the last link
      OCAjobs.last  = job.prev;
      // Clearing the new last element's next link
      OCAjobs.queue[OCAjobs.last].next = undefined;
      // Adds the OCAjobs.last to the list of nodes to be updated
      jobsToUpdate[OCAjobs.last] = OCAjobs.queue[OCAjobs.last];
    }

    // Let's now check for the next link to be transferred
    if (job.prev && OCAjobs.queue[job.prev]) {
        OCAjobs.queue[job.prev].next = job.next;
        jobsToUpdate[job.prev] = OCAjobs.queue[job.prev];
    }

    // Let's now check for the prev link to be transferred
    if (job.next && OCAjobs.queue[job.next]) {
        OCAjobs.queue[job.next].prev = job.prev;
        jobsToUpdate[job.next] = OCAjobs.queue[job.next];
    }

    // Let's remove job and order from the queue
    delete OCAjobs.queue[job.id];
    delete OCAorders.queue[job.id];

    // Delete the Job's definition
    delete job;

    // Now that it is out of the memory queue, we can remove the files
    if (fs.existsSync(job.ordFileName)) fs.unlinkSync(job.ordFileName);
    if (fs.existsSync(OCApath.order + "/ord-" + job.id)) {
      // OCAdebug("Shall remove: %s", OCApath.order + "/ord-" + job.id);
      OCAtools.rmdirSync(OCApath.order + "/ord-" + job.id);
    }
    if (fs.existsSync(job.fileName)) fs.unlinkSync(job.fileName);
    // Audit Information
    OCAaudit.server.add("Order [{0}] was removed from the system by [{1}]".format(id, ctx.sessionData.id));
    // Audit Information
    OCAaudit.server.add("Job [{0}] was removed from the system".format(id, ctx.sessionData.id));

    // Updates every Jobs that needs persisted updating (disk)
    for (var id in jobsToUpdate) {
      // We write the Jobs file
      fs.writeFile(OCAjobs.queue[id].fileName, JSON.stringify(OCAjobs.queue[id]), function (err) {
        OCAaudit.server.add("Job [{0}] was updated on persistent memory.".format(id));
        if (err && err.code != 'EEXIST') {
          OCAaudit.server.add("ERROR: Cannot update Job [{0}] (err: {1})".format(id, JSON.stringify(err)));
          throw new ApiError("Error while updating job [" + id + "]");
        }
      }); 
    }

    // Let's return not-implemented, yet
    ctx.msg.body("Order [" + id + "] was removed from the system.");
    res.json(ctx.msg);
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",

               path: "/j/:id/order", func: function Order$Status (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAjobs.queue[id] == null) {
        ctx.msg.err(new OCAErr(404, "Missing or invalid Job ID"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // Gets the Order Data
    var orderData = fs.readFile(OCAjobs.queue[id].ordFileName, 
        'utf-8', function (err, data) {
      ctx.msg.body(data);
      res.json(ctx.msg);
    });

    // All Done
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",
               path: "/j/:id/history", func: function Order$History (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAjobs.queue[id] == null) {
        ctx.msg.err(new OCAErr(404, "Missing or invalid Job ID"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAjobs.queue[id].history) {
        // Cannot be canceled, it is already processing
        ctx.msg.err(new OCAErr(404, "No history available for order ['" + id + "']."));
        res.json(ctx.msg);
        return;
    }

    // Sets the Body of the response
    ctx.msg.body(OCAjobs.queue[id].history);
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
               path: "/j/:id/processed", func: function Order$History (req, res, ctx) {

    // Shortcut
    var id = req.params.id;

    // Checks the Input
    if (id == null || id == "" || OCAjobs.queue[id] == null) {
        ctx.msg.err(new OCAErr(404, "Missing or invalid Job ID"));
        OCAtools.returnError(req, res, ctx);
        return;
    }

    // If the job is active, let's not interrupt it (might change in the future)
    if (!OCAjobs.queue[id].processed) {
        // Cannot be canceled, it is already processing
        ctx.msg.err(new OCAErr(404, "No items have been processed for ['" + id + "']."));
        res.json(ctx.msg);
        return;
    }

    // Sets the Body of the response
    ctx.msg.body(OCAjobs.queue[id].processed);
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
               path: "/j/next", func: function Order$Next (req, res, ctx) {

    // Sets the Body of the response
    res.json( { "id" : ( OCAjobs.first != null ? OCAjobs.first : undefined ) });
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",
               path: "/j/last", func: function Order$Next (req, res, ctx) {

    // Sets the Body of the response
    res.json( { "id" : ( OCAjobs.last != null ? OCAjobs.last : undefined ) });
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// @desc Retrieves the Status of an Existing Order
// @Parameters (OCAMsg Body):
//  { id : <JobID> }
// Returns:
handlers.push(
  getHandler({ method: "get",
               path: "/j/active", func: function Order$Next (req, res, ctx) {

    // Sets the Body of the response
    res.json( { "id" : ( OCAjobs.active != null ? OCAjobs.active : undefined ) });
    return;

}}, { clientCertAuth: true, reqAdmin: false, reqAudit: false }, true));

// Exports only the handlers
exports.handlers = handlers;
