console.log("\nLibPKI AddOn Test:");
console.log("==================\n");
console.log("* Opening ....: ../build/Release/pki.node");

const pki = require('../build/Release/pki.node')

console.log("* Loaded .....: ../build/Release/pki.node");
console.log("\n* Invoking ....: add() -> 2 + 3 = ", pki.add(2,3));
console.log("\n[ All Done ]\n");

return 0;

