#! /usr/bin/env node
// -*- js -*-
// "use strict";

// encrypt.js
//
// BASE SETUP
// =============================================================================

// Basic Requirements
const fs = require('fs');
const path = require('path');
const prg = require('commander');

// Loads the Crypto Framework
const crypto = require("crypto");

// Global Variables
OCAprg = null;
VERSION = "1.0.0";

// Local Template for the User
var userTemplate = { 
  id: null,
  creds: {
    passwd: null,
    cert: null,
  },
  isGlobalAdmin : false,
  isLoginRequired: true,
  email: null,
  phone: null,
  address: {
    street1 : null,
    street2 : null,
    city : null,
    state : null,
    country : null,
    zip : null
  }
};

// Let's Parse the arguments
prg.version(VERSION)
   .option('-f, --frontend', 'Manages Frontend User/Client credentials.')
   .option('-b, --backend', 'Manages Backend User/Client credentials.')
   .option('-u, --uid <username>', 'User Identifier for accessing the server.')
   .option('-c, --cert <filename>', 'Certificate to be enabled as credentials.')
   .option('-p, --password <secret>', 'User Password to access the server.')
   .option('-g, --global', "Grants the user the role of Global Administrator.")
   .option('-n, --nologin', 'No login is required (valid for certificate auth only)')
   .option('-e, --email <address>', "User's e-mail address.")
   .option('-t, --telephone <number>', "User's telephone number.")
   .option("-z, --zip <code>", "User's Zip Code.")
   .option("-s, --state <state>", "User's State (or Region).")
   .option("-r, --contry <country>", "User's Country.")
   .option("-i, --city <city>", "User's City.")
   .option("-l, --street1 <first>", "User's Address (Line one).")
   .option("-m, --street2 <second>", "User's Address (Line two).")
   .option('-v, --verbose', 'Prints additional information while running.')
   .option('-d, --debug', 'Runs in debugging mode (lots of information).')
   .parse(process.argv);

// Let's Run in one of the two modes (frontend or backend)
if (prg.frontend == true && prg.backend == true) {
  console.error("ERROR: Only one of 'frontend' or 'backend' options allowed.\n");
  return(1);
}

// Sets the Frontend Prefix
if (prg.frontend == true) {
  OCAprg = "frontend";
}

// Sets the Backend Prefix
if (prg.backend == true) {
  OCAprg = "backend";
}

// Checks we have a prefix
if (OCAprg == null) {
  console.error("ERROR: One of '-frontend' (-f) or '-backend' (-b) options required.\n");
  return(1);
}

// Global: Load Main Config and Package Info
OCAcnf = require( __dirname + "/../conf/" + OCAprg + "/" + OCAprg + "-cnf");

// Global: Useful directory names
UserDirName = path.resolve( __dirname + "/../conf/" + OCAprg + "/user.d" );
CertDirName = path.resolve( UserDirName + "/cert.d");

// Sets the Verbose and Debug Option
if (prg.verbose == true) OCAcnf.verbose = true;
if (prg.debug == true) OCAcnf.debug = true;

// Executes the banner
banner();

// Checks that the needed directories exist
if (!fs.existsSync(UserDirName)) fs.mkdirSync(UserDirName);
if (!fs.existsSync(UserDirName)) {
  console.error("ERROR: Directory [%s] does not exists, aborting.\n", UserDirName);
  process.exit(1);
}

// Checks that the needed directories exist
if (!fs.existsSync(CertDirName)) fs.mkdirSync(CertDirName);
if (!fs.existsSync(CertDirName)) {
  console.error("ERROR: Directory [%s] does not exists, aborting.\n", CertDirName);
  process.exit(1);
}

// Let's add the user
addUser(prg);

// All Done
return 0;


        // =========
        // Functions
        // =========

function banner() {
  console.log("\nOpenCA Users Tool - v" + VERSION + "\n"+
              "(c) 2019 by Massimiliano Pala and OpenCA Labs\n" +
              "All Rights Reserved\n");
}

function addUser( prg ) {

  // Checks we have the basic info
  if (typeof prg.uid === "undefined") {
    console.error("    ERROR: Missing User ID, aborting.\n");
    process.exit(1);
  }

  // Checks we have one of certificate and password
  if (typeof prg.cert === "undefined" && typeof prg.password === "undefined") {
    console.error("    ERROR: One of '--cert' or '--password' is required, aborting.\n");
    process.exit(1);
  } else if (typeof prg.cert !== "undefined" && typeof prg.password !== "undefined") {
    console.error("    ERROR: Only one of '--cert' and '--password' must be used, aborting.\n");
    process.exit(1);
  }

  // The User Instance
  var newUser = userTemplate;

  // Sanitize the username
  newUser.id = prg.uid
    .replace(/[\!\/\$\\@\{\}\"\'\<\>\;\=\#\%\&\?\|]+/gi, "")
    .replace(/^\./, "");

  // Checks if the two IDs are now the same
  if (newUser.id != prg.uid) {
    console.error("    ERROR: User ID contains non-permitted characters ([%s] in [%s]), aborting.\n", 
      prg.uid.match(/[\!\/\$\\@\{\}\"\'\<\>\;\=\#\%\&\?\|]+/), prg.uid);
    process.exit(1);
  }

  // Filename of the User's Profile
  var outName = path.resolve(__dirname + "/../conf/" + OCAprg + "/user.d/" + newUser.id + ".json").toString();

  // Checks if the same uid is already used
  if (fs.existsSync(outName)) {
    console.error("    ERROR: Uid (%s) already exists, aborting.\n", newUser.id);
    process.exit(1);
  }

  if (typeof prg.password !== "undefined") {
    // Calculates the salted hash of the password
    const hmac = crypto.createHmac('sha256', prg.uid)
        .update(prg.password)
        .digest('base64');
    // Password Credentials
    newUser.creds = {
      "password" : hmac
    };
  } else if (prg.cert != "") {
    // Checks that the file actually exists
    if (!fs.existsSync(prg.cert)) {
      console.error("    ERROR: Missing certificate file [%s], aborting.\n", prg.cert);
      process.exit(1);
    }
    // Assigns the Filename to the user configuration
    newUser.creds = {
      "cert" : path.resolve("./cert.d/" + newUser.id)
    };
  } else {
    console.error("    ERROR: Missing credentials (either a cert or a password), aborting.\n");
    process.exit(1);
  }

  // Sets the Admin/GlobalAdmin flags
  if (prg.global == true) newUser.isGlobalAdmin = true;

  // Setup an address temporary object
  var myAddress = { };

  // Sets the user's details
  if (prg.email != "") newUser.email = prg.email;
  if (prg.telephone != "") newUser.phone = prg.telephone;

  // Setup the Address
  if (prg.street1 != "") myAddress.street1 = prg.street1;
  if (prg.street2 != "") myAddress.street2 = prg.street2;
  if (prg.city != "") myAddress.city = prg.city;
  if (prg.state != "") myAddress.state = prg.state;
  if (prg.zip != "") myAddress.zip = prg.zip;
  if (prg.country != "") myAddress.country = prg.country;

  // Checks the login requirements
  if (prg.nologin == true) {
    // Checks for inconsistency with username/password usage
    if (newUser.creds.password != null) {
      console.error("\n    [ERROR] Login is always required with username/password, aborting.\n")
      process.exit(1);
    }
    // Sets the Login as Required
    newUser.isLoginRequired = true;
  } else if (newUser.creds.cert != null) {
    // Login is required for non-cert users
    newUser.isLoginRequired = false;
  } else {
    // Login is required for all other users
    newUser.isLoginRequired = true;
  }

  // Checks if the address is actually required or not
  if (Object.keys(myAddress).length > 0) {
    newUser.address = myAddress;
  } else {
    delete newUser.address;
    newUser.address = undefined;
  }

  // No the FS operations
  try {

    // Checks if the same uid is already used
    if (fs.existsSync(outName)) {
      console.error("    ERROR: Uid (%s) already exists, aborting.\n", newUser.id);
      process.exit(1);
    }

    console.log("* Creating New User:");
    console.log("  - User ID ............: " + newUser.id);
    console.log("  - E-Mail .............: " + (newUser.email != null ? newUser.email : "n/a"));
    console.log("  - Telephone ..........: " + (newUser.phone != null ? newUser.phone : "n/a"));
    console.log("  - Creds Type .........: " + (newUser.creds.cert != null ? "Certificate" : "Password"));

    if (typeof prg.cert !== "undefined") {
      // Destination Certificate FileName
      var sourceCertName = path.resolve(prg.cert);
      var destCertName = CertDirName + "/" + newUser.id + "-cert.pem";

      // Checks if we need to copy the certificate
      if (destCertName != sourceCertName) {
        console.log("\n* Copying the Certificate file:");
        console.log("  - Source .............: " + sourceCertName );
        console.log("  - Destination ........: " + destCertName );

        // Gets the Certificate from the source file
        const userCert = fs.readFileSync(sourceCertName);
        if (userCert == "") {
          console.error("ERROR: Cannot access the certificate file [%s], aborting.", prg.cert);
          process.exit(1);
        }

        // Writes the new certificate filename in the appropriate directory
        fs.writeFileSync(destCertName, userCert);
        if (!fs.existsSync(destCertName)) {
          console.error("ERROR: Cannot copy the certificate file to [%s], aborting.", destCertName);
          process.exit(1);
        }

        // Sets the Certificate Filename
        newUser.creds.cert = destCertName;
      }
    }

    // Saves the data into the target user file
    fs.writeFile(outName, JSON.stringify(newUser), function (err) {
      if (err) {
        console.log("ERROR: Cannot add new user (id: " + newUser.id + ") - Code: " + err + "\n");
      } else {
        console.log("\n* User Created Successfully:");
        console.log("  - Config file ........: " + outName + "\n");
        console.log("* All Done.\n");
      }
    });
    
  } catch (e) {
    // Unspecified Error
    console.log("ERROR: Cannot add new user (file: " + outName + ") - Code: " + e);
  }

  // All Done
  return 1;
}

function modUser( userId, field, data ) {

  // Input check
  if (!userId) {
    throw new ApiError(
      "ERROR: userId (" + userId +
      "), userSecret (" + typeof(userSecret) + 
      "), and email (" + email + 
      ") are needed!");
  }
 
  // Sanitize the username
  userId = OCAtools.sanitizeUserId(userId);

  // Filename of the User's Profile
  var fileName = "conf/users/" + userId + ".json";

  try {

    // Checks if the user already exists
    if (fs.existsSync( fileName )) {

      // Loads the File
      var newUser = JSON.parse(fs.readFileSync(inName, 'fileName', function(err, data) {
        throw new ApiError("ERROR: Cannot load user (" + userId + ")", err);
      }));

      // Adds the mod data
      switch (field) {

        case "email" : {
          newUser.email = data;
        } break;

        case "password" : {
          console.log("'%s':'%s'", userId, data);
          const hmac = crypto.createHmac('sha256', userId);
          hmac.update(data);
          newUser.passwd = hmac.digest('base64');
        } break;

        case "street1" : {
          newUser.address.street1 = data;
        } break;

        case "street2" : {
          newUser.address.street2 = data;
        } break;

        case "city" : {
          newUser.address.city = data;
        } break;

        case "state" : {
          newUser.address.state = data;
        } break;

        case "country" : {
          newUser.address.country = data;
        } break;

        case "zip" : {
          newUser.address.zip = data;
        } break;

        case "address" : {
          var dataObj = JSON.parse(data);

          if (data.street1) newUser.street1 = data.street1;
          if (data.street2) newUser.street2 = data.street2;
          if (data.city) newUser.city = data.city;
          if (data.state) newUser.state = data.state;
          if (data.country) newUser.country = data.country;
          if (data.zip) newUser.zip = data.zip;

        } break;

        default: {
          throw new ApiError("Field " + field + " not supported.");
        }
      }
      
      if (email) newUser.email = email;

      // Saves the data into the target user file
      fs.writeFile(fileName, JSON.stringify(newUser), function (err) {
        if (err) {
          console.log("ERROR: Cannot update the user (" + newUser.id + ") - Code: " + err);
        } else {
          console.log("User (" + newUser.id + ") updated successfully [Path: " + outName + "]");
        }
      });

    }
  } catch (e) {
    // Unspecified Error
    console.log("ERROR: Cannot add new user (out: " + outName + ") - Code: " + e);
  }

  // All Done
  return 1;
}
