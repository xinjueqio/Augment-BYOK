"use strict";

const fs = require("fs");

function fail(msg) {
  console.error(`[contracts] ERROR: ${String(msg || "unknown error")}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[contracts] ${String(msg || "")}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function escapeRegExp(s) {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  const txt = readText(filePath);
  return JSON.parse(txt);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a || typeof a !== "string" || !a.startsWith("--")) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    const v = next && typeof next === "string" && !next.startsWith("--") ? next : "1";
    if (v !== "1") i += 1;
    out[k] = v;
  }
  return out;
}

module.exports = { fail, ok, assert, escapeRegExp, readText, readJson, parseArgs };

