"use strict";

const { assert, ok } = require("./util");

function assertAugmentProtocolShapes(augmentProtocol) {
  assert(augmentProtocol && typeof augmentProtocol === "object", "augment-protocol not object");
  assert(typeof augmentProtocol.makeBackChatChunk === "function", "augment-protocol.makeBackChatChunk missing");
  assert(typeof augmentProtocol.rawResponseNode === "function", "augment-protocol.rawResponseNode missing");
  assert(typeof augmentProtocol.mainTextFinishedNode === "function", "augment-protocol.mainTextFinishedNode missing");
  assert(typeof augmentProtocol.toolUseNode === "function", "augment-protocol.toolUseNode missing");
  assert(typeof augmentProtocol.toolUseStartNode === "function", "augment-protocol.toolUseStartNode missing");
  assert(typeof augmentProtocol.thinkingNode === "function", "augment-protocol.thinkingNode missing");
  assert(typeof augmentProtocol.tokenUsageNode === "function", "augment-protocol.tokenUsageNode missing");

  const chunk = augmentProtocol.makeBackChatChunk({ text: "hi" });
  assert(chunk && typeof chunk === "object", "makeBackChatChunk must return object");
  assert(typeof chunk.text === "string", "makeBackChatChunk.text must be string");
  assert(Array.isArray(chunk.unknown_blob_names), "makeBackChatChunk.unknown_blob_names must be array");
  assert(typeof chunk.checkpoint_not_found === "boolean", "makeBackChatChunk.checkpoint_not_found must be boolean");
  assert(Array.isArray(chunk.workspace_file_chunks), "makeBackChatChunk.workspace_file_chunks must be array");

  const chunkWithStop = augmentProtocol.makeBackChatChunk({ text: "", stop_reason: augmentProtocol.STOP_REASON_END_TURN });
  assert(typeof chunkWithStop.stop_reason === "number", "makeBackChatChunk.stop_reason must be number when present");

  const chunkWithEmptyNodes = augmentProtocol.makeBackChatChunk({ text: "", nodes: [], includeNodes: true });
  assert(Array.isArray(chunkWithEmptyNodes.nodes), "makeBackChatChunk(includeNodes).nodes must be array");

  const raw = augmentProtocol.rawResponseNode({ id: 1, content: "x" });
  assert(raw && typeof raw === "object", "rawResponseNode must return object");
  assert(raw.type === augmentProtocol.RESPONSE_NODE_RAW_RESPONSE, "rawResponseNode.type mismatch");
  assert(typeof raw.id === "number", "rawResponseNode.id must be number");
  assert(typeof raw.content === "string", "rawResponseNode.content must be string");

  const main = augmentProtocol.mainTextFinishedNode({ id: 2, content: "done" });
  assert(main.type === augmentProtocol.RESPONSE_NODE_MAIN_TEXT_FINISHED, "mainTextFinishedNode.type mismatch");
  assert(typeof main.content === "string", "mainTextFinishedNode.content must be string");

  const tu = augmentProtocol.toolUseNode({ id: 3, toolUseId: "tool_1", toolName: "my_tool", inputJson: "{\"a\":1}" });
  assert(tu.type === augmentProtocol.RESPONSE_NODE_TOOL_USE, "toolUseNode.type mismatch");
  assert(typeof tu.content === "string", "toolUseNode.content must be string");
  assert(tu.tool_use && typeof tu.tool_use === "object" && !Array.isArray(tu.tool_use), "toolUseNode.tool_use must be object");
  assert(typeof tu.tool_use.tool_use_id === "string", "toolUseNode.tool_use.tool_use_id must be string");
  assert(typeof tu.tool_use.tool_name === "string", "toolUseNode.tool_use.tool_name must be string");
  assert(typeof tu.tool_use.input_json === "string", "toolUseNode.tool_use.input_json must be string");

  const tus = augmentProtocol.toolUseStartNode({ id: 4, toolUseId: "tool_1", toolName: "my_tool", inputJson: "{\"a\":1}" });
  assert(tus.type === augmentProtocol.RESPONSE_NODE_TOOL_USE_START, "toolUseStartNode.type mismatch");
  assert(tus.tool_use && typeof tus.tool_use === "object", "toolUseStartNode.tool_use must be object");

  const think = augmentProtocol.thinkingNode({ id: 5, summary: "hmm" });
  assert(think.type === augmentProtocol.RESPONSE_NODE_THINKING, "thinkingNode.type mismatch");
  assert(think.thinking && typeof think.thinking === "object", "thinkingNode.thinking must be object");
  assert(typeof think.thinking.summary === "string", "thinkingNode.thinking.summary must be string");

  const usage = augmentProtocol.tokenUsageNode({ id: 6, inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4 });
  assert(usage.type === augmentProtocol.RESPONSE_NODE_TOKEN_USAGE, "tokenUsageNode.type mismatch");
  assert(usage.token_usage && typeof usage.token_usage === "object", "tokenUsageNode.token_usage must be object");
  assert(usage.token_usage.input_tokens === 1, "tokenUsageNode.input_tokens mismatch");
  assert(usage.token_usage.output_tokens === 2, "tokenUsageNode.output_tokens mismatch");
  assert(usage.token_usage.cache_read_input_tokens === 3, "tokenUsageNode.cache_read_input_tokens mismatch");
  assert(usage.token_usage.cache_creation_input_tokens === 4, "tokenUsageNode.cache_creation_input_tokens mismatch");

  ok("augment-protocol shapes ok");
}

module.exports = { assertAugmentProtocolShapes };

