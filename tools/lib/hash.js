"use strict";

const crypto = require("crypto");
const fs = require("fs");

function sha256FileHex(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

module.exports = { sha256FileHex };

