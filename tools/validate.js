#! /usr/bin/env node
// -*- js -*-
// "use strict";

var fs    = require('fs')
var path  = require('path');

var dir = __dirname;

var inName = process.argv[2];
var outName = process.argv[3];

// Loads the States File
var value = JSON.parse(fs.readFileSync(inName, 'utf8', function(err, data) {
  console.log("ERROR: " + err);
  throw err;
}));

// Saves the country complete file
if (outName != null) {
  fs.writeFile(outName, JSON.stringify(value));
}

// Output
// console.log("Parsed Successfully (" + inName + ")");
