const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractErrorMessageFromJson,
  readHttpErrorDetail,
  makeUpstreamHttpError
} = require("../payload/extension/out/byok/providers/request-util");

test("extractErrorMessageFromJson: OpenAI error shape", () => {
  const json = { error: { message: "bad", type: "invalid_request_error", code: "foo" } };
  assert.equal(extractErrorMessageFromJson(json), "invalid_request_error/foo: bad");
});

test("extractErrorMessageFromJson: Anthropic error shape", () => {
  const json = { type: "error", error: { type: "invalid_request_error", message: "nope" } };
  assert.equal(extractErrorMessageFromJson(json), "invalid_request_error: nope");
});

test("extractErrorMessageFromJson: Gemini error shape", () => {
  const json = { error: { message: "denied", status: "PERMISSION_DENIED" } };
  assert.equal(extractErrorMessageFromJson(json), "PERMISSION_DENIED: denied");
});

test("readHttpErrorDetail: prefers structured message + request id", async () => {
  const body = JSON.stringify({ error: { message: "bad", type: "invalid_request_error", code: "foo" } });
  const resp = new Response(body, { status: 400, headers: { "x-request-id": "req_123" } });
  const detail = await readHttpErrorDetail(resp, { maxChars: 300 });
  assert.equal(detail, "invalid_request_error/foo: bad (request_id=req_123)");
});

test("makeUpstreamHttpError: sets name/status and includes label", async () => {
  const resp = new Response("rate limited", { status: 429, headers: { "request-id": "req_999" } });
  const err = await makeUpstreamHttpError(resp, { label: "openai", maxChars: 50 });
  assert.equal(err.name, "UpstreamHttpError");
  assert.equal(err.status, 429);
  assert.match(err.message, /^openai 429:/);
  assert.match(err.message, /\(request_id=req_999\)$/);
});

