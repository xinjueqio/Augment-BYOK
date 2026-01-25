const test = require("node:test");
const assert = require("node:assert/strict");

const { isInvalidRequestStatusForFallback } = require("../payload/extension/out/byok/providers/provider-util");

test("isInvalidRequestStatusForFallback: supports 400/422 only", () => {
  assert.equal(isInvalidRequestStatusForFallback(400), true);
  assert.equal(isInvalidRequestStatusForFallback("400"), true);
  assert.equal(isInvalidRequestStatusForFallback(422), true);
  assert.equal(isInvalidRequestStatusForFallback(401), false);
  assert.equal(isInvalidRequestStatusForFallback(null), false);
  assert.equal(isInvalidRequestStatusForFallback(undefined), false);
});

