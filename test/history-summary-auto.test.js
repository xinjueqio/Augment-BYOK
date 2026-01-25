const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveHistorySummaryConfig, resolveContextWindowTokens } = require("../payload/extension/out/byok/core/augment-history-summary/auto/config");
const { computeTailSelection } = require("../payload/extension/out/byok/core/augment-history-summary/auto/tail-selection");
const { REQUEST_NODE_TOOL_RESULT } = require("../payload/extension/out/byok/core/augment-protocol");

test("historySummary: resolveHistorySummaryConfig applies defaults and normalizes numbers", () => {
  const cfg = {
    historySummary: {
      enabled: true,
      triggerOnHistorySizeChars: 1234
    }
  };

  const hs = resolveHistorySummaryConfig(cfg);
  assert.ok(hs);
  assert.equal(hs.triggerOnHistorySizeChars, 1234);
  assert.equal(hs.minTailExchanges, 2);
  assert.equal(hs.maxTokens, 1024);
  assert.equal(hs.timeoutSeconds, 60);
  assert.equal(hs.cacheTtlMs, 0);
  assert.equal(hs.maxSummarizationInputChars, 0);
  assert.equal(hs.triggerStrategy, "auto");
  assert.ok(hs.abridgedHistoryParams && typeof hs.abridgedHistoryParams === "object" && !Array.isArray(hs.abridgedHistoryParams));
});

test("historySummary: resolveContextWindowTokens picks longest matching override key", () => {
  const hs = {
    contextWindowTokensOverrides: {
      "gpt": 8000,
      "gpt-4o": 128000
    }
  };

  const tokens = resolveContextWindowTokens(hs, "byok:openai:gpt-4o-mini");
  assert.equal(tokens, 128000);
});

test("historySummary: computeTailSelection shifts boundary earlier to avoid tool_result orphan start", () => {
  const toolResultNode = {
    type: REQUEST_NODE_TOOL_RESULT,
    tool_result_node: { tool_use_id: "tool_1", content: "ok" }
  };

  const history = [
    { request_id: "r0", request_message: "u0", response_text: "a0", request_nodes: [], structured_request_nodes: [], nodes: [], response_nodes: [], structured_output_nodes: [] },
    { request_id: "r1", request_message: "u1", response_text: "a1", request_nodes: [], structured_request_nodes: [], nodes: [], response_nodes: [], structured_output_nodes: [] },
    { request_id: "r2", request_message: "", response_text: "", request_nodes: [toolResultNode], structured_request_nodes: [], nodes: [], response_nodes: [], structured_output_nodes: [] },
    { request_id: "r3", request_message: "u3", response_text: "a3", request_nodes: [], structured_request_nodes: [], nodes: [], response_nodes: [], structured_output_nodes: [] }
  ];

  const hs = { minTailExchanges: 2 };
  const decision = { thresholdChars: 1, tailExcludeChars: 0 };

  const sel = computeTailSelection({ history, hs, decision });
  assert.ok(sel);
  assert.equal(sel.tailStart, 1);
  assert.equal(sel.boundaryRequestId, "r1");
  assert.equal(sel.droppedHead.length, 1);
  assert.equal(sel.droppedHead[0].request_id, "r0");
  assert.equal(sel.tail[0].request_id, "r1");
});

