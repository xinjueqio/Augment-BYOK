const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSystemPrompt } = require("../payload/extension/out/byok/core/augment-chat");

test("buildSystemPrompt: includes byok_system_prompt (and keeps tool/context lines last)", () => {
  const sys = buildSystemPrompt({
    user_guidelines: "UG",
    workspace_guidelines: "WG",
    rules: ["R1", "R2"],
    agent_memories: "MEM",
    byok_system_prompt: "BYOK",
    mode: "AGENT",
    lang: "javascript",
    path: "src/app.js"
  });

  assert.ok(sys.includes("BYOK"));
  assert.ok(sys.includes("You are an AI coding assistant with access to tools."));
  assert.ok(sys.includes("The user is working with javascript code."));
  assert.ok(sys.includes("Current file path: src/app.js"));

  const idxByok = sys.indexOf("BYOK");
  const idxTool = sys.indexOf("You are an AI coding assistant with access to tools.");
  assert.ok(idxByok >= 0 && idxTool >= 0 && idxByok < idxTool);
});

