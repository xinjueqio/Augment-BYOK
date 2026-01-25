"use strict";

function normalizePositiveInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function pickPositiveIntFromRecord(record, keys) {
  const r = record && typeof record === "object" && !Array.isArray(record) ? record : {};
  const list = Array.isArray(keys) ? keys : [];
  for (const k of list) {
    if (!k || typeof k !== "string") continue;
    const n = normalizePositiveInt(r[k]);
    if (n != null) return n;
  }
  return null;
}

function deleteKeysFromRecord(record, keys) {
  const r = record && typeof record === "object" && !Array.isArray(record) ? record : null;
  if (!r) return false;
  const list = Array.isArray(keys) ? keys : [];
  let changed = false;
  for (const k of list) {
    if (!k || typeof k !== "string") continue;
    if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
    delete r[k];
    changed = true;
  }
  return changed;
}

module.exports = { normalizePositiveInt, pickPositiveIntFromRecord, deleteKeysFromRecord };
