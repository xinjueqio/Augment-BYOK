#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { run } = require("../lib/run");

const ROOTS = [
  "payload/extension/out/byok",
  "tools"
];

function listJsFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent || typeof ent.name !== "string") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsFiles(p));
    else if (ent.isFile() && ent.name.endsWith(".js")) out.push(p);
  }
  return out;
}

function main() {
  const repoRoot = path.resolve(__dirname, "../..");

  let total = 0;
  for (const relRoot of ROOTS) {
    const absRoot = path.join(repoRoot, relRoot);
    if (!fs.existsSync(absRoot)) throw new Error(`missing dir: ${absRoot}`);
    const files = listJsFiles(absRoot).sort();
    total += files.length;
    console.log(`[node-check] ${relRoot}: ${files.length}`);
    for (const f of files) run("node", ["--check", f], { cwd: repoRoot });
  }
  console.log(`[node-check] OK (total=${total})`);
}

main();

