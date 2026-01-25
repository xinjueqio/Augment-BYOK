const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizePositiveInt,
  pickPositiveIntFromRecord,
  deleteKeysFromRecord
} = require("../payload/extension/out/byok/providers/request-defaults-util");

test("request-defaults-util: normalizePositiveInt returns null for non-positive", () => {
  assert.equal(normalizePositiveInt(null), null);
  assert.equal(normalizePositiveInt(undefined), null);
  assert.equal(normalizePositiveInt(""), null);
  assert.equal(normalizePositiveInt("0"), null);
  assert.equal(normalizePositiveInt(0), null);
  assert.equal(normalizePositiveInt(-1), null);
  assert.equal(normalizePositiveInt(NaN), null);
  assert.equal(normalizePositiveInt(Infinity), null);
});

test("request-defaults-util: normalizePositiveInt floors finite positive numbers", () => {
  assert.equal(normalizePositiveInt(1), 1);
  assert.equal(normalizePositiveInt(1.9), 1);
  assert.equal(normalizePositiveInt("2"), 2);
  assert.equal(normalizePositiveInt("3.1"), 3);
});

test("request-defaults-util: pickPositiveIntFromRecord picks first positive key by order", () => {
  const rec = { a: 0, b: "5", c: 2 };
  assert.equal(pickPositiveIntFromRecord(rec, ["a", "b", "c"]), 5);
  assert.equal(pickPositiveIntFromRecord(rec, ["a", "c", "b"]), 2);
});

test("request-defaults-util: deleteKeysFromRecord deletes only existing keys and returns changed", () => {
  const rec = { a: 1, b: 2 };
  assert.equal(deleteKeysFromRecord(rec, ["x"]), false);
  assert.equal(deleteKeysFromRecord(rec, ["b", "x"]), true);
  assert.deepEqual(rec, { a: 1 });
});

