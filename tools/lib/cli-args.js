"use strict";

function getArgValue(argv, name) {
  const args = Array.isArray(argv) ? argv : [];
  const key = String(name || "");
  const idx = args.indexOf(key);
  if (idx < 0) return null;
  const next = idx + 1 < args.length ? args[idx + 1] : null;
  if (next == null) return null;
  const v = String(next);
  if (!v || v.startsWith("--")) return null;
  return v;
}

function hasFlag(argv, name) {
  const args = Array.isArray(argv) ? argv : [];
  const key = String(name || "");
  return args.indexOf(key) >= 0;
}

function getBooleanArg(argv, name) {
  const args = Array.isArray(argv) ? argv : [];
  const key = String(name || "");
  const idx = args.indexOf(key);
  if (idx < 0) return false;
  const next = idx + 1 < args.length ? args[idx + 1] : null;
  if (next == null) return true;
  const v = String(next);
  if (!v || v.startsWith("--")) return true;
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return Boolean(v);
}

module.exports = { getArgValue, hasFlag, getBooleanArg };

