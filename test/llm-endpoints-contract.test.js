const test = require("node:test");
const assert = require("node:assert/strict");

const { LLM_ENDPOINT_SPECS } = require("../tools/report/llm-endpoints-spec");
const { SUPPORTED_CALL_API_ENDPOINTS } = require("../payload/extension/out/byok/runtime/shim/call-api");
const { SUPPORTED_CALL_API_STREAM_ENDPOINTS } = require("../payload/extension/out/byok/runtime/shim/call-api-stream");
const { defaultConfig } = require("../payload/extension/out/byok/config/config");

function sorted(xs) {
  return Array.from(new Set(Array.isArray(xs) ? xs : [])).sort();
}

test("LLM endpoints: spec matches runtime shims", () => {
  const specCallApi = sorted(LLM_ENDPOINT_SPECS.filter((s) => s && s.kind === "callApi").map((s) => s.endpoint));
  const specCallApiStream = sorted(LLM_ENDPOINT_SPECS.filter((s) => s && s.kind === "callApiStream").map((s) => s.endpoint));

  assert.deepEqual(specCallApi, SUPPORTED_CALL_API_ENDPOINTS);
  assert.deepEqual(specCallApiStream, SUPPORTED_CALL_API_STREAM_ENDPOINTS);
});

test("LLM endpoints: defaultConfig routes all to byok", () => {
  const cfg = defaultConfig();
  for (const spec of LLM_ENDPOINT_SPECS) {
    const ep = spec && typeof spec === "object" ? String(spec.endpoint || "") : "";
    assert.ok(ep && ep.startsWith("/"), `bad spec endpoint: ${ep || "(empty)"}`);
    const r = cfg.routing.rules[ep];
    assert.ok(r && typeof r === "object", `missing default routing rule: ${ep}`);
    assert.equal(r.mode, "byok", `default routing rule must be byok: ${ep}`);
  }
});
