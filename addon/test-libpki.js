// =============================================
//         LibPKI and Crypto Utils Tests
// (c) 2020 by Massimiliano Pala and OpenCA Labs
//             All Rights Reseved
// =============================================

console.log("\nLibPKI AddOn Test:");
console.log("==================\n");
console.log("* Opening ....: ../build/Release/pki.node");

const pki = require('../build/Release/pki.node')

console.log("* Loaded .....: ../build/Release/pki.node");
console.log("\n* Invoking ...: add() -> 2 + 3 = ", pki.add(2,3));

                        // ================
                        // Crypto Extension
                        // ================

const crypto = require('crypto');
console.log("\n* Loaded .....: crypto");

const key = 'keykeykeykeykeykeykeykey';
const nonce = crypto.randomBytes(12);

const aad = Buffer.from('0123456789', 'hex');

// Encrypt Data (Symmetric)
// ------------------------

const cipher = crypto.createCipheriv('aes-192-gcm', key, nonce, {
  authTagLength: 16
});
const plaintext = 'Hello world';
cipher.setAAD(aad, {
  plaintextLength: Buffer.byteLength(plaintext)
});
const ciphertext = cipher.update(plaintext, 'utf8');
cipher.final();
const tag = cipher.getAuthTag();

console.log("* NONCE ......:", nonce);
console.log("* Tag ........:", tag);
console.log("* Encrypted ..:", ciphertext);

// Decrypt Data (Symmetric)
// ------------------------

const decipher = crypto.createDecipheriv('aes-192-gcm', key, nonce, {
  authTagLength: 16
});
decipher.setAuthTag(tag);
decipher.setAAD(aad, {
  plaintextLength: ciphertext.length
});
const receivedPlaintext = decipher.update(ciphertext, null, 'utf8');

try {
  decipher.final();
} catch (err) {
  console.error('Authentication failed!');
  return;
}

console.log("* Decrypted ..:", receivedPlaintext);
console.log(receivedPlaintext);

/*
const algorithm = 'aes-192-cbc';
const password = 'Password used to generate key';
// Use the async `crypto.scrypt()` instead.
const key2 = 'kekekekekekekekekekekeke';
// The IV is usually passed along with the ciphertext.
const iv = Buffer.alloc(16, 0); // Initialization vector.

const decipher2 = crypto.createDecipheriv(algorithm, key2, iv);

// Encrypted using same algorithm, key and iv.
const encrypted =
  'e5f79c5915c02171eec6b212d5520d44480993d7d622a7c4c2da32f6efda0ffa';
let decrypted = decipher2.update(encrypted, 'hex', 'utf8');
decrypted += decipher2.final('utf8');
console.log(decrypted);
// Prints: some clear text data
*/

console.log("\n[ All Done ]\n");

return 0;

