#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const MAX_FILE_LINES = 400;
const JS_FILENAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const DIRNAME_RE = JS_FILENAME_RE;

const ROOTS = [
  "payload/extension/out/byok",
  "tools",
  "test"
];

const EXCEPTIONS = {};

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

function listDirs(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent || typeof ent.name !== "string") continue;
    if (!ent.isDirectory()) continue;
    if (ent.name === "node_modules") continue;
    if (ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    out.push(p, ...listDirs(p));
  }
  return out;
}

function countLines(text) {
  const parts = String(text || "").split(/\r?\n/);
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts.length;
}

function stripShebang(text) {
  const s = String(text || "");
  if (!s.startsWith("#!")) return s;
  const i = s.indexOf("\n");
  return i === -1 ? "" : s.slice(i + 1);
}

function isPureRequireForwarder(text) {
  let t = stripShebang(text).replace(/^\uFEFF/, "").trim();
  t = t.replace(/^(['"])use strict\1;\s*/i, "").trim();
  return /^module\.exports\s*=\s*require\(\s*(['"])[^'"]+\1\s*\)\s*;?\s*$/.test(t);
}

function isValidJsFilename(relPath) {
  const fileName = String(relPath || "").split("/").pop() || "";
  if (!fileName.endsWith(".js")) return false;
  const base = fileName.slice(0, -".js".length);
  return JS_FILENAME_RE.test(base);
}

function isValidDirname(relPath) {
  const dirName = String(relPath || "").split("/").pop() || "";
  if (!dirName) return false;
  if (dirName.startsWith(".")) return true;
  if (dirName === "node_modules") return true;
  return DIRNAME_RE.test(dirName);
}

function main() {
  const repoRoot = path.resolve(__dirname, "../..");
  const violations = [];
  const filenameViolations = [];
  const dirnameViolations = [];
  const nameCollisions = [];
  const requireForwarders = [];
  const staleExceptions = [];
  const missingExceptions = [];

  for (const rel of Object.keys(EXCEPTIONS)) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) missingExceptions.push(rel);
  }

  let scanned = 0;
  let scannedDirs = 0;
  for (const rootRel of ROOTS) {
    const rootAbs = path.join(repoRoot, rootRel);
    if (!fs.existsSync(rootAbs)) continue;
    for (const dirAbs of listDirs(rootAbs)) {
      const rel = path.relative(repoRoot, dirAbs).replace(/\\/g, "/");
      scannedDirs += 1;
      if (!isValidDirname(rel)) dirnameViolations.push(rel);
    }
    for (const fileAbs of listJsFiles(rootAbs)) {
      const rel = path.relative(repoRoot, fileAbs).replace(/\\/g, "/");
      if (!isValidJsFilename(rel)) filenameViolations.push(rel);
      const base = path.basename(fileAbs, ".js");
      const siblingDir = path.join(path.dirname(fileAbs), base);
      try {
        if (fs.existsSync(siblingDir) && fs.statSync(siblingDir).isDirectory()) {
          const siblingRel = path.relative(repoRoot, siblingDir).replace(/\\/g, "/");
          nameCollisions.push({ file: rel, dir: siblingRel });
        }
      } catch {}
      const text = fs.readFileSync(fileAbs, "utf8");
      const lc = countLines(text);
      if (isPureRequireForwarder(text)) requireForwarders.push(rel);
      scanned += 1;

      const reason = EXCEPTIONS[rel];
      if (lc > MAX_FILE_LINES && !reason) violations.push({ rel, lines: lc });
      if (lc <= MAX_FILE_LINES && reason) staleExceptions.push({ rel, lines: lc, reason });
    }
  }

  console.log(`[codestyle] js files scanned: ${scanned}`);
  console.log(`[codestyle] dirs scanned: ${scannedDirs}`);
  console.log(`[codestyle] max lines per file: ${MAX_FILE_LINES}`);
  console.log("[codestyle] filename style: kebab-case(.kebab-case)*.js");
  console.log("[codestyle] dirname style: kebab-case(.kebab-case)*");
  console.log("[codestyle] module layout: disallow foo.js + foo/ collisions");
  console.log("[codestyle] module layout: disallow pure require-forwarders");

  if (missingExceptions.length) {
    console.warn(`[codestyle] WARN: exceptions reference missing files (${missingExceptions.length})`);
    for (const rel of missingExceptions.sort()) console.warn(`- ${rel}`);
  }

  if (staleExceptions.length) {
    console.warn(`[codestyle] WARN: exceptions no longer needed (${staleExceptions.length})`);
    for (const e of staleExceptions.sort((a, b) => b.lines - a.lines)) {
      console.warn(`- ${e.rel} (${e.lines} lines) — ${e.reason}`);
    }
  }

  if (filenameViolations.length) {
    console.error(`[codestyle] FAIL: bad .js filenames (${filenameViolations.length})`);
    for (const rel of filenameViolations.sort()) console.error(`- ${rel}`);
    process.exit(1);
  }

  if (dirnameViolations.length) {
    console.error(`[codestyle] FAIL: bad directory names (${dirnameViolations.length})`);
    for (const rel of dirnameViolations.sort()) console.error(`- ${rel}`);
    process.exit(1);
  }

  if (nameCollisions.length) {
    console.error(`[codestyle] FAIL: file+dir name collisions (${nameCollisions.length})`);
    for (const c of nameCollisions.sort((a, b) => (a.file < b.file ? -1 : 1))) {
      console.error(`- ${c.file} <-> ${c.dir}`);
    }
    process.exit(1);
  }

  if (requireForwarders.length) {
    console.error(`[codestyle] FAIL: pure require-forwarders (${requireForwarders.length})`);
    for (const rel of requireForwarders.sort()) console.error(`- ${rel}`);
    process.exit(1);
  }

  if (violations.length) {
    console.error(`[codestyle] FAIL: oversized files (${violations.length})`);
    for (const v of violations.sort((a, b) => b.lines - a.lines)) {
      console.error(`- ${v.rel} (${v.lines} lines)`);
    }
    process.exit(1);
  }

  console.log("[codestyle] OK");
}

main();
