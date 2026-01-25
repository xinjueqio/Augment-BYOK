const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeGeminiRequestDefaults } = require("../payload/extension/out/byok/providers/gemini/request");

test("gemini requestDefaults: maps max_tokens/maxTokens/max_output_tokens to generationConfig.maxOutputTokens", () => {
  const out = normalizeGeminiRequestDefaults({ max_tokens: 123, maxTokens: 456, max_output_tokens: 789, maxOutputTokens: 321 });
  assert.equal(out.generationConfig.maxOutputTokens, 321);
  assert.equal("max_tokens" in out, false);
  assert.equal("maxTokens" in out, false);
  assert.equal("max_output_tokens" in out, false);
  assert.equal("maxOutputTokens" in out, false);
});

test("gemini requestDefaults: maps max_completion_tokens -> generationConfig.maxOutputTokens", () => {
  const out = normalizeGeminiRequestDefaults({ max_completion_tokens: 200 });
  assert.equal(out.generationConfig.maxOutputTokens, 200);
  assert.equal("max_completion_tokens" in out, false);
});

test("gemini requestDefaults: does not override existing generationConfig.maxOutputTokens", () => {
  const out = normalizeGeminiRequestDefaults({ max_tokens: 123, generationConfig: { maxOutputTokens: 42, temperature: 0.2 } });
  assert.deepEqual(out.generationConfig, { maxOutputTokens: 42, temperature: 0.2 });
});
