const test = require("node:test");
const assert = require("node:assert/strict");

const { defaultConfig } = require("../payload/extension/out/byok/config/config");
const { decideRoute } = require("../payload/extension/out/byok/core/router");

test("decideRoute: empty endpoint => official", () => {
  const cfg = defaultConfig();
  const r = decideRoute({ cfg, endpoint: "", body: {}, runtimeEnabled: true });
  assert.equal(r.mode, "official");
  assert.equal(r.reason, "empty_endpoint");
});

test("decideRoute: runtime disabled => rollback to official", () => {
  const cfg = defaultConfig();
  const r = decideRoute({ cfg, endpoint: "/chat", body: { model: "byok:openai:gpt-4o-mini" }, runtimeEnabled: false });
  assert.equal(r.mode, "official");
  assert.equal(r.endpoint, "/chat");
  assert.equal(r.reason, "rollback_disabled");
});

test("decideRoute: byok (default rule) picks provider/model from byok:model", () => {
  const cfg = defaultConfig();
  const r = decideRoute({ cfg, endpoint: "/chat-stream", body: { model: "byok:openai:gpt-4o-mini" }, runtimeEnabled: true });
  assert.equal(r.mode, "byok");
  assert.equal(r.endpoint, "/chat-stream");
  assert.equal(r.reason, "byok");
  assert.equal(r.provider.id, "openai");
  assert.equal(r.model, "gpt-4o-mini");
});

test("decideRoute: disabled rule => disabled", () => {
  const cfg = defaultConfig();
  const r = decideRoute({ cfg, endpoint: "/user-secrets/list", body: { model: "byok:openai:gpt-4o-mini" }, runtimeEnabled: true });
  assert.equal(r.mode, "disabled");
  assert.equal(r.endpoint, "/user-secrets/list");
  assert.equal(r.reason, "rule");
});

test("decideRoute: model override forces byok when rule is official", () => {
  const cfg = defaultConfig();
  const r = decideRoute({ cfg, endpoint: "/record-request-events", body: { model: "byok:openai:gpt-4o-mini" }, runtimeEnabled: true });
  assert.equal(r.mode, "byok");
  assert.equal(r.endpoint, "/record-request-events");
  assert.equal(r.reason, "model_override");
  assert.equal(r.provider.id, "openai");
  assert.equal(r.model, "gpt-4o-mini");
});

