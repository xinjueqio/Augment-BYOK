const test = require("node:test");
const assert = require("node:assert/strict");

const { redactText } = require("../payload/extension/out/byok/infra/log");

test("redactText: Bearer token", () => {
  const token = "sk-proj-1234567890abcdef1234567890abcdef";
  const input = `Authorization: Bearer ${token}`;
  const out = redactText(input);
  assert.equal(out, "Authorization: Bearer ***");
  assert.ok(!out.includes("sk-proj-"));
});

test("redactText: sk-ant-...", () => {
  const input = "sk-ant-1234567890abcdef1234567890abcdef";
  const out = redactText(input);
  assert.equal(out, "sk-ant-***");
});

test("redactText: sk-proj-...", () => {
  const input = "sk-proj-1234567890abcdef1234567890abcdef";
  const out = redactText(input);
  assert.equal(out, "sk-proj-***");
});

test("redactText: sk-... (supports -/_)", () => {
  const input = "sk-1234_abcd-efgh5678ijkl";
  const out = redactText(input);
  assert.equal(out, "sk-***");
});

test("redactText: ace_...", () => {
  const input = "ace_1234567890abcdef";
  const out = redactText(input);
  assert.equal(out, "ace_***");
});

test("redactText: does not redact normal text", () => {
  const input = "mask-proj-1234 is not a token; sk-1234 too short";
  const out = redactText(input);
  assert.equal(out, input);
});

