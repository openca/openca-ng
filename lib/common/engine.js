/*
 * OCAEngine For OpenCA NG
 * (c) 21016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved
 */

// Constant Variables
const fs = require('fs');
const crypto = require('crypto');

// Constructor for OCAErr
function OCAErr(errno, desc, aux) {

  // Reference to itself
  var me      = this;
  var errData = undefined;

  // Sets the defaults
  me.__errno = -1;
  me.__desc  = null;
  me.__aux   = null;

  // If we only have one argument, let's check if that is the
  // value of internals of an existing or serialized OCAErr
  // If we got data in the string format let's check if we can parse the JSON
  // out of it
  if (arguments.length === 1) {

    try {
      if (typeof(errno) === "string") {
        errData = JSON.parse(errno);
      } else if (typeof(errno) === "object") {
        errData = errno;
      } else if (typeof(data) === "undefined") {
        // Nothing to do
      } else if (typeof(errno) === "number") {
        // Nothing to do
      } else {
        throw new ApiError("data (type) not supported (" + typeof(data) + ")");
      }
    }
    catch (e) {
      // Logs the Error and throw
      console.log("ERROR: Can not create a new OCAMsg");
      throw new ApiError("Exception: " + e, e);
    }

    // Analyzes the internal structure of the message and checks
    // if we have the right structure
    if (errData                 !=  null &&
        typeof(errData.__errno) !== "undefined" &&
        typeof(errData.__desc)  !== "undefined" &&
        typeof(errData.__aux)   !== "undefined") {

          // Assigns the internals
          me.__errno = errData.__errno;
          me.__desc  = errData.__desc;
          me.__aux   = errData.__aux;

          // Cleans up the first arguments
          errno = undefined;
    }
  }

  // Object's Internal Function
  me.setValue = function setValue(name, value) {
    // Input Checks
    if (typeof(name) !== "string") return;
    // Sets the value (if any was provided)
    if (value) me[name] = value;
    return me[name];
  }

  // Basic Properties
  if (errno != null) me.setValue("__errno", errno);
  if (desc != null) me.setValue("__desc", desc);
  if (aux != null) me.setValue("__aux", aux);

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

OCAErr.prototype.errno = function (value) {
  var me = this;
  return me.setValue("__errno", value);
}

OCAErr.prototype.desc = function (value) {
  var me = this;
  return me.setValue("__desc", value);
}

OCAErr.prototype.aux = function (value) {
  var me = this;
  return me.setValue("__aux", value);
}

/*
 * OCAMsg Class (JSON Message for OCAEngine)
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved
 */

// Constructor for OCAMsg
function OCAMsg(data) {

  // Reference to itself
  var me = this;
  var dataObj = undefined;
  var msgData = undefined;

  // MSG
  me.__msg = { links : { self: "", prev: "", next: "" }, err: null, auth: null, body : null };

  // If we got data in the string format let's check if we can parse the JSON
  // out of it
  try {
    if (typeof(data) === "string") {
      dataObj = JSON.parse(data);
    } else if (typeof(data) === "object") {
      dataObj = data;
    } else if (typeof(data) === "undefined") {
      // Nothing to do
    } else {
      throw new ApiError("data (type) not supported (" + typeof(data) + ")");
    }
  }
  catch (e) {
    // Logs the Error and throw
    console.log("ERROR: Can not create a new OCAMsg");
    throw (e);
  }

  // Let's Check if we have body or a real message as input. If the second, we
  // just set the internal data of the message to the passed value
  if (typeof(dataObj)          !== "undefined" &&
      typeof(dataObj['__msg']) !== "undefined") {
    // Assigns the internals to the msgData to be inspected
    msgData = data['__msg'];
  } else {
    // Assigns the data directly to the msgData to be inspected
    msgData = data;
  }

  // Analyzes the internal structure of the message and checks
  // if we have the right structure
  if (msgData != null && msgData instanceof OCAMsg) {
    me.__msg = msgData;
    data = undefined;
  } else if (msgData           !=  null &&
      typeof(msgData['err'])   !== "undefined" &&
      typeof(msgData['links']) !== "undefined" &&
      typeof(msgData['body'])  !== "undefined" &&
      typeof(msgData['auth']   !== "undefined" )) {
        // For the Err, we need to generate a new object and then
        // assign the internals accordingly
        me.__msg['err'] = new OCAErr(msgData.err);
        // Now let's set the body
        me.__msg['body'] = msgData.body;
        // Now let's set the links
        me.__msg['links'] = msgData.links;
        // Now let's set the Auth
        me.__msg['auth'] = msgData.auth;
        // Removes the 'data' parameters as it
        // has already been userId
        data = undefined;
  }

  // Analyzes the internal structure of the message and checks
  // if we have the right structure
  if (msgData && msgData instanceof OCAErr) {
    me.__msg['err'] = msgData;
    data = undefined;
  } else if (msgData                    !=  null &&
             typeof(msgData['__errno']) !== "undefined" &&
             typeof(msgData['__desk'])  !== "undefined" &&
             typeof(msgData['__aux'])   !== "undefined") {
    me.__msg['err'] = new OCAErr(msgData);
    data = undefined;
  }

  // Object's Internal Function. The expected arguments are
  // as follows:
  //
  // Case 1: only value is provided
  // @arg0 -> the specified section's value is returned
  //
  // Case 2: section and value are provided
  // @arg0 -> the section of the message (i.e. links, body, or err)
  // @arg1 -> the object containing the sub-section and value (e.g., for
  //   the links section, a valid object is  { prev : "..." }, while
  //   for the err section, a valid OCAErr object is required
  //
  // For the body section, no checks are performed (i.e., an object or a
  // string are good values)
  me.value = function value(section, value) {

    // Input Checks
    if (typeof(section) === "undefined" || section == null) return undefined;

    // Checks if the section exists
    if (typeof(me.__msg[section]) === "undefined") {
      throw("OCAMsg does not support section '%s'", section);
    }

    // If no value is provided, let's return the requested section
    if (typeof(value) === "undefined") return me.__msg[section];

    // Checks for valid patterns
    switch(section) {

      case "auth" : {
        // Sets the value in message
        return me.__msg[section] = value;
      } break;

      case "body" : {
        // Sets the value in message
        return me.__msg[section] = value;
      } break;

      case "links" : {
        // Data Checks
        for (var i in value) {
           if (typeof(me.__msg[section][i]) === "undefined") {
             throw ("Value name (" + i + ") for section (" + section + ") not supported!");
           }
        };
        // Sets the value in message
        for (var i in value) {
          if (value[i]) me.__msg[section][i] = value[i];
        }
        return me.__msg[section];
      } break;

      case "err" : {
        if (typeof(value) !== "object") {
          throw ("Error should be a OCAErr object");
        };
        return me.__msg[section] = value;
      } break;

      default: {
        throw("OCAMsg does not support section(" + section + ")");
      }
    }
  }

  // Basic Properties
  if (data != null) me.value("body", data);

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

// Returns a copy of the MSG object
OCAMsg.prototype.get = function() { var copy = this.__msg; return copy; };

// Returns the MSG object in JSON format (stringified)
OCAMsg.prototype.getJSON = function() { return JSON.stringify(this.__msg); };

// Sets the "prev" property and returns the links section
OCAMsg.prototype.prev = function (value) {
  return this.value("links" , { "prev" : value }).prev;
}

// Sets the "self" property and returns the links section
OCAMsg.prototype.self = function (value) {
  return this.value("links" , { "self" : value }).self;
}

// Sets the "next" property and returns the links section
OCAMsg.prototype.next = function (value) {
  return this.value("links" , { "next" : value }).next;
}

// Sets and/or Returns the err object (if any) from the message
OCAMsg.prototype.err = function (value) {
  var value = this.value("err", value);

  // Checks if we have a value for the error
  if (value != null) {
    // If we have an empty error, let's just
    // return null
    if (value.errno() == -1   &&
        value.desc()  == null &&
        value.aux()   == null) {
      return null;
    }
  }

  // If we have a valid value, let's return it
  return value;
}

OCAMsg.prototype.clear = function() {
  this.__msg = { links : { self: "", prev: "", next: "" }, err: null, auth: null, body : null };
}

// Sets and/or Returns the body object (if any) from the message
OCAMsg.prototype.body = function (value) {
  return this.value("body", value);
}

// Sets and/or Returns the auth object (if any) from the message
OCAMsg.prototype.auth = function (value) {
  return this.value("auth", value);
}

if (typeof(exports) !== "undefined") {
  exports.OCAMsg = OCAMsg;
  exports.OCAErr = OCAErr;
}

/*
 * Debug Console
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

function OCAdebug(text, ...myArgs) {

  // Logs only if Debugging is active
  if (typeof OCAcnf === 'undefined' || OCAcnf.debug != true) return;

  // If the First Argument is a string, let's augment it
  if (typeof(text) == "string") {

    var funcName = __stack[1].getFunctionName() || "main";
    var lineNum  = __stack[1].getLineNumber();

    var newText = "[" + funcName + "():" + lineNum + "] " + text;

    // Calls the Console Logging Function
    console.log(newText, ...myArgs);
  } else {
    console.log(text, ...myArgs);
  }
}

if (typeof(exports) !== "undefined") {
  exports.OCAdebug = OCAdebug;
}

/*
 * Debug Console
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

function OCAlog(...myArgs) {

  // Only Console output supported for now
  console.log(...myArgs);
}

if (typeof(exports) !== "undefined") {
  exports.OCAlog = OCAlog;
}

/*
 * Debug Console
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

function OCAverb(...myArgs) {

  // Logs only if Debugging is active
  if (typeof OCAcnf === 'undefined' || OCAcnf.verbose != true) return;

  // Only Console output supported for now
  console.log(...myArgs);
}

if (typeof(exports) !== "undefined") {
  exports.OCAverbose = OCAverb;
  exports.OCAverb = OCAverb;
}

/*
 * Logs into the OpenCA NG Server
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

function OCAlogin(baseUrl, config, callback) {

  var retMsg = new OCAMsg();
  var errMsg = null;

  // Checks we have a good config object
  if (config == null) {
    retMsg.err(new OCAErr(500, "Missing required ('config') parameter."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }

  // Checks the Username requirement
  if (typeof config.username === "undefined") {
    retMsg.err(new OCAErr(500, "Missing required ('config.username') parameter."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }

  // Checks for the Organization requirement
  if (typeof config.org === "undefined") {
    retMsg.err(new OCAErr(500, "Missing required ('config.org') parameter."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }

  // Default Hashing Algorithm
  if (typeof config.algor === "undefined") {
    // Use sha256 as the default algor for the hmacPepper
    config.algor = "sha256";
  }

  // Login Data
  var data = {
    "uid" : config.username,
    "org" : config.org
  };

  // Checks if we are using a secret or a public key
  if (config.password != null) {
    // Gets the Freshness Date
    const date   = new Date();
    const pepper = date.getUTCFullYear() + 
      ("0" + (date.getUTCMonth() + 1)).slice(-2) +
      ("0" + (date.getUTCDate() + 1)).slice(-2);

    // Calculates the right password. The first algorithm is
    // actually fixed (sha256), while the algorithm for the
    // hmacPepper is actually configurable (sha256, sha384,
    // sha512, ripemd160)
    const hmac = crypto.createHmac('sha256', config.username)
        .update(config.password)
        .digest('base64');

    // Calculate the hmacPepper value (combines also the date)
    const hmacPepper = crypto.createHmac(config.algor, hmac)
        .update(pepper)
        .digest('base64');

    // Generates the Creds session
    data.creds = {
      "type"   : "password",
      "algor"  : "sha256",
      "pepper" : pepper,
      "value"  : hmacPepper
    };

  } else if (config.tlsOptions != null && 
             config.tlsOptions.certName != null) {

    // Generates an "empty" creds session
    data.creds = {
      "type" : "certificate"
    };

  } else {
    // Error, no credentials recognized
    retMsg.err(new OCAErr(-1, "Missing credentials type for login."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }


  // Where to send the JSON
  var loginPath = baseUrl + "/u/login/" + config.org;

OCAdebug(data);

  // Sends the request for login
  OCAquery("post", loginPath, config.tlsOptions, data, callback);

  // All Done
  return;
}

if (typeof(exports) !== "undefined") {
  exports.OCAlogin = OCAlogin;
}

/*
 * Logs into the OpenCA NG Server
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reserved
 */

function OCAlogout(baseUrl, opt, callback) {

  // Path to the Logout Resource
  var myPath = baseUrl + "/u/logout";

  // Return Objects
  var retMsg = new OCAMsg();
  var errMsg = null;

  // Shortcut for tlsOptions
  var tlsOptions = (opt != null ? opt.tlsOptions : undefined );

  // Checks we have a good baseUrl object
  if (baseUrl == null) {
    retMsg.err(new OCAErr(500, "Missing required ('baseUrl') parameter."));
    if (typeof callback === "function") return callback(retMsg, null);
    return null;
  }

  // Sends the request for login
  OCAquery("post", myPath, tlsOptions, { "id" : opt.username, "org" : opt.org}, callback);

  // All Done
  return;
}

if (typeof(exports) !== "undefined") {
  exports.OCAlogout = OCAlogout;
}

/*
 * Sends an HTTP query to the server
 *
 * @method { string } - One of "get", "post", or "head"
 * @path { string } - Is the URL to connect to
 * @options { json } - Is the options as in http(s).request()
 * @reqAuth { string } - The Authorization token for the request
 * @callback { function } - Callback function for processing the response
 */

function OCAquery(method, path, options, data, callback ) {

  // Myself
  var me = {};
  var reqMsg = undefined;
  var bodyData = "";

  // Local requirements
  me.url     = require('url');
  me.https   = require('https');
  me.tls     = require('tls');

  var __callback = callback;
  
  switch (method) {
    case "get"  :
    case "post" :
    case "head" :
    case "delete" :
    case "put"  :
      break;

    default:
      throw new Error("Method '%s' not supported", method);
  }

  // Make sure we have an options object
  if (options == null) {
    options = { };
  }

  // Let's check the url
  var url_obj = me.url.parse(path);

  // Sets the options
  options.method   = method;
  options.port     = url_obj.port;
  options.hostname = url_obj.hostname;
  options.protocol = url_obj.protocol;
  options.path     = url_obj.pathname;

  if (url_obj.search) {
    options.path = options.path + url_obj.search;
  }

  // If a POST message, we need an OCAMsg
  if (method == "post" || method == "POST") {
    // If we have some JSON already,
    // let's use it in the msg body
    if (data != null) {
      if (data instanceof OCAMsg) {
        // We re-use the MSG object
        reqMsg = data;
      } else {
        // Generates a new OCAMsg object
        reqMsg = new OCAMsg(data);
      }
      // Sets the Auth Code for the Message
      if (options.reqAuth != null && options.reqAuth != "") {
        reqMsg.auth(options.reqAuth);
      }
    } else {
      // We need a new message
      reqMsg = new OCAMsg();
      // Sets the Auth Code for the Message
      if (options.reqAuth != null && options.reqAuth != "") {
        reqMsg.auth(options.reqAuth);
      }
    }
    // Gets the bodyData
    bodyData = reqMsg.getJSON();

    // If we have data, we need to set the headers accordingly
    options.headers = {
      'Content-Type': 'application/json',
      'Content-Length': bodyData.length
    };

  }

  // Checks if we have a reqAuth or reqAuthPath
  // in our options, if so, let's load the token (if needed)
  if (options.reqAuthPath != "") {
    if (fs.existsSync(options.reqAuthPath)) {
      options.reqAuth = fs.readFileSync(options.reqAuthPath, 'utf-8')
                          .replace(/(\r\n|\n|\r)/gm,"");
    }
  }

  // Let's set the authentication cookie, if needed
  if (options.reqAuth != "") {
    // Checks we have an headers object
    if (options.headers == "") options.headers = { };
    // Populate the headers' Cookie value
    options.headers["Cookie"] = "OCApki=" + options.reqAuth;
  }

  // Let's save the current options

  // Server Identity Switch
  options.checkServerIdentity = (function(){

    this.options = options;

    return function $OCAQuery$client$ceckServerIdentity (host, cert) {

      // Function to recursively check the whole chain
      function checkConstraints(config, cert, level = 0) {

        // Input check
        if (config == null || cert == null) return false;

        // Checks if the certificate can be compared
        OCAdebug("Missing code to compare the cert from serverAuth with the 'cert' from the socket.");

        // Checks the fields in the subject
        if (config.subject !== undefined && config.subject != null) {
          // OCAdebug("Checking config.subject = %s", config.subject);
          for (var i in config.subject) {
            // OCAdebug("Checking Subject property => %s [cert: %s, config: %s]", i, cert.subject[i], config.subject[i]);
            if (!cert.subject || !cert.subject[i]) {
              OCAdebug("[Level %d] ERROR: Missing property '%s' in server's certificate subject.", level, i);
              return 1;
            } else if (cert.subject[i] != config.subject[i]) {
              OCAdebug("[Level %d] ERROR: Attribute [%s] of the Certificate Subject [value: '%s', expected: '%s']",
                level, i, cert.subject[i], config.subject[i]);
              return 1;
            }
          }
        }

        // Checks the fields in the issuer
        if (config.issuer !== undefined && config.issuer != null) {
          // OCAdebug("Checking config.issuer = %s", config.issuer);
          for (var i in config.issuer) {
            // OCAdebug("Checking Issuer property => %s [cert: %s, config: %s]", i, cert.issuer[i], config.issuer[i]);
            if (!cert.issuer || !cert.issuer[i]) {
              OCAdebug("[Level %d] ERROR: Missing property '%s' in server's certificate Issuer.", level, i);
              return 1;
            } else if (cert.issuer[i] != config.issuer[i]) {
              OCAdebug("[Level %d] ERROR: Attribute [%s] of the Certificate Issuer [value: '%s', expected: '%s']",
                level, i, cert.issuer[i], config.issuer[i]);
              return 1;
            }
          }
        }

        // Let's check if there is another level we need to check
        if (config.issuerCertificate != null) {
          // Let's check the case where no other certs are provided
          // via the socket
          if (cert.issuerCertificate == null) {
            OCAdebug("ERROR: Constraints found for next chain level, but no next chain certificate was found.");
            return 1;
          }
          // Let's now return the check for the next level
          return checkConstraints(config.issuerCertificate, cert.issuerCertificate, level+1);
        }

      }

      // Make sure the certificate is issued to the host we are connected to
      const err = me.tls.checkServerIdentity(host, cert);

      // Checks which error is it
      if (err) {
        // Checks the different errors
        if (err.code == 'SELF_SIGNED_CERT_IN_CHAIN') {
          // Overridable Error
          OCAdebug("ERROR: Server Mis-Configuration (SELF_SIGNED_CERT_IN_CHAIN)");

        } else if (err.host != "localhost" && err.host != "127.0.0.1") {
          // If the used hostname is "localhost" or "127.0.0.1", the name
          // checks are overridden (allows for easy testing/debugging)
          return err;
        }
      }

      // Let's print the certificate
      if (typeof options.serverAuth !== "undefined") {
        // Shortcut to the serverAuth options
        var srvOpt = options.serverAuth;
        // Checks the certificate against the serverAuth config
        checkConstraints(srvOpt, cert);
        // Debugging
        // OCAdebug(cert);
      }
      // Let's not return an error
      return;
    }

  })();

  // Generates the Request
  var aRequest = me.https.request(options, res => {

    // Local Container for the data
    var resData = null;

    // Adds data to the response body
    res.on('data', data => {
      if (resData == null) resData = "" + data;
      else resData += data;
    });

    // Deals with the error condition
    res.on('error', err => {
      var errMsg = new OCAErr(500, "Error", err);
      var msg = new OCAMsg(errMsg);
      return __callback(msg, res);
    })

    // Deals with the end (message received)
    res.on('end', function() {
      // Local Callback Variables
      var msg = null;
      var errMsg = null;

      // Builds the return message
      try {
        // Converts the body into an OCAMsg (if possible)
        if (typeof(resData) === "undefined" || resData == null) {
          msg = new OCAMsg();
        } else if (typeof(resData) === "object" ) {
          msg = new OCAMsg(resData);
        } else if (typeof(resData) === "string" ) {
          try {
            msg = new OCAMsg(JSON.parse(resData));
          } catch (e) {
            msg = new OCAMsg();
            msg.body(resData.toString());
          }
        }
      } catch (e) {
        // Error while converting the returned data
        OCAdebug("Internal Error while generating OCAMsg");
        console.dir(e, 4, true);
      }

      // If we have authentication information, let's save it
      // in the AUTHPATH file
      if (msg.auth() != null && msg.auth() != "") {

        // Saves the reqAuth value
        reqAuth = msg.auth();

        // If the AUTHPATH is defined, let's write the auth info
        // in the AUTHPATH file for session resumption
        if (typeof options.reqAuthPath !== "undefined" && options.reqAuthPath != "") {

          // Saves the data into the target user file
          fs.writeFileSync(options.reqAuthPath, reqAuth, function (err) {
            if (err) {
              OCAdebug("ERROR: Cannot store auth token (%s), aborting.", options.reqAuthPath);
              process.exit(1);
            }
          });
        }
      }

      // Finally calls the callback
      return __callback(msg, res);
    });

  });

  // Process the Errors in the Request
  aRequest.on('error', (err) => {
    if (err != null && err.code != null) {
      console.log("[TLS ERROR] Cannot connect to server ['%s://%s:%d'] (code: %s), aborting.", 
        options.protocol, options.hostname, options.port, err.code);
    }
    else if (err != null && err.reason != null) {
      console.log("[TLS ERROR] %s, aborting.", err.reason);
    }
    else {
      console.log("[TLS ERROR] Cannot connect to server (errObj: %s), aborting.", JSON.stringify(err));
    }

    // Generates the message for the callback
    var msg = new OCAMsg(new OCAErr(err.code, "Cannot connect to the server", err));
    OCAdebug(msg);

    // Invokes the Callback
    __callback(msg, err);

  });

  // Writes the Data for the body
  aRequest.write(bodyData);
  // Ends the request
  aRequest.end();
  // All Done
  return aRequest;
}

if (typeof(exports) !== "undefined") {
  exports.OCAquery = OCAquery;
}

/*
 * CryptoInit function for https TLS initialization
 */

function TlsCryptoInit(auth, keyName, certName, caName, srvAuth) {

  var me  = {};
      // Myself

  var ret = { };
    // Return Variable

  // Checks the Key and the Certificate
  if (keyName != null && keyName != "") {
    ret.keyName = keyName;
  } else if (auth != null && auth.clientAuth != null) {
    ret.keyName = auth.privKey;
  }

  // Checks we have a good path
  if (ret.keyName != null) {
    if (!fs.existsSync(ret.keyName)) {
    OCAlog("\nERROR: Cannot find the key file ('%s')\n", ret.keyName);
    return null;
    }

    // Loads the Key
    ret.key = fs.readFileSync(ret.keyName, 'utf-8');
  }

  // Gets the Client Certificate path
  if (certName != null && certName != "") {
    ret.certName = certName;
  } else if (auth != null && auth.clientAuth != null) {
    ret.certName = auth.clientAuth.certAndChain;
  }

  // Checks for the existance of the Certificate
  if (ret.certName != null) {
    if (!fs.existsSync(ret.certName)) {
      OCAlog("\nERROR: Cannot find the certificate file ('%s')\n", ret.certName);
      return null;
    }

    // Loads the Key
    ret.cert = fs.readFileSync(ret.certName, 'utf-8');
  }

  // Gets the Client Certificate path
  if (caName != null && caName != "") {
    ret.caName = caName;
  } else if (auth != null && auth.clientAuth != null) {
    ret.caName = auth.clientAuth.trustedCas;
  }

  // Checks for the existance of the Certificate
  if (ret.caName != null) {
    if (!fs.existsSync(ret.caName)) {
      OCAlog("\nERROR: Cannot find the Trusted CAs file ('%s')\n", ret.caName);
      return null;
    }

    // Loads the Key
    ret.ca = fs.readFileSync(ret.caName, 'utf-8');
  }

  // Gets the Client Certificate path
  if (srvAuth != null && srvAuth != "") {
    ret.serverAuth = srvAuth;
  } else if (auth != null) {
    ret.serverAuth = auth.serverAuth;
  }

  // Load certificates
  function __loadServerCerts(authObj) {

    // Nothing to do if nothing is passed
    if (authObj == null) return;

    // Checks for the existance of the Certificate
    if (authObj != null && typeof authObj.certName !== "undefined") {
      // Check the existance
      if (!fs.existsSync(authObj.certName)) {
        OCAlog("\nERROR: Cannot find certificate file ('%s')\n", ret.certName);
        return null;
      }
      // Loads certificate
      authObj.certificate = fs.readFileSync(authObj.certName, 'utf-8');
    }

    // If we have the issuer to process, let's do it
    if (authObj.issuerCertificate != null) 
      __loadServerCerts(authObj.issuerCertificate);
  }

  // Recursively loads the server (and CAs) certificate
  // for chain validation
  __loadServerCerts(ret.serverAuth);

  // Useful
  ret.headers = {};

  // Returns the Object with the data loaded
  return ret;
}

if (typeof(exports) !== "undefined") {
  exports.TlsCryptoInit = TlsCryptoInit;
}

/*
 * ApiError Class
 * (c) 2019 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved
 *
 * References:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
 */

// Constructor for Err
function ApiError(message, aux) {

  var me = this;

  // Sets the defaults
  this.name    = "ApiError";
  this.message = message || "Generic Error";
  this.stack = Error.captureStackTrace(this, this);
  this.aux     = aux;

  if (typeof(aux) === "object") {
    ApiError.prototype.dumpObject(aux);
  } else {
    console.trace(this.name + ": " + this.message +
      " (aux: " + JSON.stringify(this.aux) + ")");
  }

  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

ApiError.prototype.toString = function() {
  var ret = this.name + ": " + this.message + "\n" +
            this.stack + "\n" +
            (this.aux != null ? JSON.stringify(this.aux) : "");
  return ret;
};

ApiError.prototype.dumpObject = function(obj) {

  if (obj == null) obj = this.aux;

  console.log("=== DumpObject ===\n{ ");
  for (i in obj) {
    console.log("  " + i + " : " + obj[i] + ",");
  }
  console.log("}\n\n");
}

if (typeof(exports) !== "undefined") {
  exports.ApiError = ApiError;
}

Object.defineProperty(global, '__stack', {
get: function() {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function(_, stack) {
            return stack;
        };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(global, '__line', {
get: function() {
        return __stack[1].getLineNumber();
    }
});

Object.defineProperty(global, '__function', {
get: function() {
        return __stack[1].getFunctionName();
    }
});
