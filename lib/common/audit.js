/*
 * OCAaudit For OpenCA NG
 * (c) 2016 by Massimiliano Pala and OpenCA Labs
 * All Rights Reseved 
 */

// Constructor for OCAErr
function OCAaudit(dir, options) {

  // Reference to itself
  var me      = this;

  // Crypto and FS Object
  me.crypto   = require('crypto');
  me.fs       = require('fs');

  // Star Time
  me.startedOn = new Date();

  // Sets the defaults
  me.dir = dir;
  me.options  = ( options != null ? options : { } );

  if (me.options.filename != null) {
    me.filename = dir + "/" + me.options.filename;
  } else if (me.options.prefix != null) {
    me.filename = dir + "/log-" + me.options.prefix + "-" +
      me.startedOn.getUTCFullYear() +
      "." + ("0" + (me.startedOn.getUTCMonth() + 1)).slice(-2) +
      "." + ("0" + me.startedOn.getUTCDate()).slice(-2) + 
      ".json";
  } else {
    me.filename = dir + "/log-" +
      me.startedOn.getUTCFullYear() +
      "." + ("0" + (me.startedOn.getUTCMonth() + 1)).slice(-2) +
      "." + ("0" + me.startedOn.getUTCDate()).slice(-2) +
      "-" + ("0" + me.startedOn.getUTCHours()).slice(-2) +
      ":" + ("0" + me.startedOn.getUTCMinutes()).slice(-2) + 
      ":" + ("0" + me.startedOn.getUTCSeconds()).slice(-2) + 
      "-" + process.pid + 
      ".json";
  }

  // Signature File Name
  me.sigFilename = me.filename + ".sig";

  // Default publishing queue
  me.queue = {
    values : [],
    head : null,
    tail : null
  };

  // Checks for the basic parameter
  if (typeof dir === "undefined" || dir == null) {
    throw new ApiError("Cannot instantiate OCAaudit object, missing [dir] parameter.");
    return undefined;
  }

  // Checks for the directory's existance
  if (!me.fs.existsSync(dir)) {
    throw new ApiError("Audit directory [{0}] does not exists.".format(dir));
    return undefined;
  }

  // Let's initialize some internal values
  me.__signing = 0;
  me.timer = null;
  me.interval = 1000;

  // This is the function that will be executed
  // every { internval }. The me.timer contains the
  // timer object that can be stopped with clearTimeout()
  var OCAaudit$New$inner = function () {

    if (me.queue.values != null && me.queue.values.length > 0) {

      var item = null;
      var text = "";
      while ((item = me.queue.values.shift()) != null) {
        text = text + JSON.stringify(item) + "\n";
      };

      if (text != null && text != "") {
        // Let's add to the file
        me.fs.appendFile(me.filename, text, err => {

          if (err) { 
            throw new ApiError("Cannot Append to File (" + err + ")");
            return;
          }

          // Generates the file signature
          if (me.key != null) me.sign();

        });
      }
    }
    me.timer = setTimeout(OCAaudit$New$inner, me.interval);
  };

  me.timer = setTimeout(OCAaudit$New$inner, me.interval);

  if (me.options) {

    if (me.options.key != null) {
      // Checks if that exists
      if (!me.fs.existsSync(me.options.key.id)) {
        throw new ApiError("Missing Audit Signing Key ['{0}'].".format(me.options.key.id));
      }

      // Based on the type of keys, let's do something different
      switch (me.options.key.type) {

        // Software Type of Key
        case "software" : {
          // Load the Private Key for Signing
          me.key = { "filename": me.options.key.id, "data": me.fs.readFileSync(me.options.key.id) };
          OCAdebug("MISSING CODE: We need a method to load the signing key");
        } break;

        default : {
          throw new ApiError("Audit Key Type [{0}] is not supported, aborting audit.".format(me.options.key.type));
          process.exit(2);
        }
      }
    };
  }

  // Let's open the latest file, if it exists
  // and read what the latest log was it

  // Checks for the last log file that was recorded
  if (me.fs.existsSync(dir + "/" + "log-latest.txt")) {
    // read the file's contents
    var latestFileName = me.fs.readFileSync(dir + "/" + "log-latest.txt", 'utf-8');
    // Checks if the file exists or not
    if (!me.fs.existsSync(latestFileName)) {
      me.add("[ERROR] Missing Last Audit Log File [{0}].".format(latestFileName.replace(new RegExp("\\/" + dir,''), "")));
      me.add("Starting a new Audit Log Chain [New Pid: {0}]".format(process.pid));
    } else if (latestFileName != me.filename) {
      // Adds initial logging message
      me.add("Chained Log File [New Pid: {0}]".format(process.pid));
      // Adds the refernce to the previous Audit Log File
      me.add("Previous (chained) Audit Log File [name: {0}]"
            .format(latestFileName.replace(new RegExp("\\/" + dir,''), "")));
      // Now that we have decoded the cert it's now in DER-encoding
      const bin = me.fs.readFileSync(latestFileName);
      // Generates the hash data over the DER representation of the cert
      const hash = me.crypto.createHash('sha256').update(bin).digest('hex').toUpperCase();
      // Adds the Hash of the previous file to this file
      me.add("Last Audit Log File Hash is [sha256:{0}]".format(hash));
    } else {
      // Just adding to an existing file
      me.add("Resuming Logging Activities [New Pid: {0}]".format(process.pid));
    }
  } else {
    // Adds the indication there is not previous "log-latest.txt" file
    // and, therefore, we are starting a new log chain
    me.add("Starting a new Audit Log Chain [New Pid: {0}]".format(process.pid));
  }

  // We now want to overwrite (or create) the new latest file
  me.fs.writeFileSync(dir + "/" + "log-latest.txt", me.filename);

  // Return the constructor
  return me;
}

                        // ==========
                        // Prototypes
                        // ==========

OCAaudit.prototype.add = function OCAAudit$prototype$add (text) {
  var me = this;
  if (me.queue.values != null) {
    me.queue.values.push({ "date" : new Date(), "text" : text });
  }
};

OCAaudit.prototype.sign = function OCAAudit$prototype$sign() {

  // Reference to itself
  var me = this;

  // Signs only if we have a key
  if (me.key != null) {
    const sign = me.crypto.createSign('SHA256');
    sign.update(me.fs.readFileSync(me.filename));;
    sign.end();

    // Stores the signature
    const signature = sign.sign(me.key.data);
    me.fs.writeFileSync(me.sigFilename, signature);
  }

  // All done
  return;
};

if (typeof(exports) !== "undefined") {
  exports.OCAaudit = OCAaudit;
}


