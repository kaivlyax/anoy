require("dotenv").config();

console.log("TEST FILE RUNNING");

const Identity = require("./models/Identity");

console.log("MODEL RECEIVED:");
console.log(Identity);

console.log("TYPE:");
console.log(typeof Identity);
