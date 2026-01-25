const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeStringList } = require("../payload/extension/out/byok/infra/util");

test("normalizeStringList: ignores non-string entries and trims/dedups", () => {
  const out = normalizeStringList([" a ", 1, null, undefined, { a: 1 }, "b", "a", "", "  "], { maxItems: 50 });
  assert.deepEqual(out, ["a", "b"]);
});

test("normalizeStringList: respects maxItems cap", () => {
  const out = normalizeStringList(["a", "b", "c", "d"], { maxItems: 2 });
  assert.deepEqual(out, ["a", "b"]);
});

