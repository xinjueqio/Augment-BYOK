"use strict";

const { normalizeString } = require("../../infra/util");
const { normalizeUsageInt, makeToolMetaGetter } = require("../provider-util");
const { extractErrorMessageFromJson } = require("../request-util");
const { buildToolUseChunks, buildTokenUsageChunk, buildFinalChatChunk } = require("../chat-chunks-util");
const {
  mapAnthropicStopReasonToAugment,
  rawResponseNode,
  thinkingNode,
  makeBackChatChunk
} = require("../../core/augment-protocol");

function extractTextFromAnthropicMessageJson(json) {
  const rec = json && typeof json === "object" ? json : null;
  if (!rec) return "";
  if (typeof rec.content === "string" && rec.content.trim()) return rec.content.trim();
  const blocks = Array.isArray(rec.content) ? rec.content : [];
  const text = blocks.map((b) => (b && b.type === "text" && typeof b.text === "string" ? b.text : "")).join("");
  return text.trim() ? text : "";
}

function extractTextFromAnthropicJson(json) {
  const obj = json && typeof json === "object" ? json : null;
  if (!obj) return "";
  const out =
    extractTextFromAnthropicMessageJson(obj) ||
    extractTextFromAnthropicMessageJson(obj?.message) ||
    normalizeString(obj?.completion ?? obj?.output_text ?? obj?.outputText ?? obj?.text);
  if (out) return out;

  const choice0 = Array.isArray(obj.choices) ? obj.choices[0] : null;
  const m = choice0 && typeof choice0 === "object" ? choice0.message : null;
  const oaiText = normalizeString(m?.content) || normalizeString(choice0?.text);
  return oaiText;
}

function normalizeToolInputToJsonString(input) {
  if (typeof input === "string") return normalizeString(input) || "{}";
  if (input && typeof input === "object") {
    try {
      return JSON.stringify(input);
    } catch {
      return "{}";
    }
  }
  return "{}";
}

async function* emitAnthropicJsonAsAugmentChunks(json, { toolMetaByName, supportToolUseStart } = {}) {
  const obj = json && typeof json === "object" ? json : null;
  const msg = obj?.message && typeof obj.message === "object" ? obj.message : obj;
  if (!msg || typeof msg !== "object") throw new Error("Anthropic(chat-stream) 响应不是有效 JSON");
  if (msg.type === "error" || msg.error) {
    const emsg = normalizeString(extractErrorMessageFromJson(msg)) || "upstream error";
    throw new Error(`Anthropic(chat-stream) upstream error: ${emsg}`.trim());
  }

  const getToolMeta = makeToolMetaGetter(toolMetaByName);
  let nodeId = 0;
  let fullText = "";
  let sawToolUse = false;
  let stopReason = null;
  let stopReasonSeen = false;

  const sr = normalizeString(msg.stop_reason ?? msg.stopReason);
  if (sr) {
    stopReasonSeen = true;
    stopReason = mapAnthropicStopReasonToAugment(sr);
  }

  const usage = msg.usage && typeof msg.usage === "object" ? msg.usage : null;
  const usageInputTokens = usage ? normalizeUsageInt(usage.input_tokens) : null;
  const usageOutputTokens = usage ? normalizeUsageInt(usage.output_tokens) : null;
  const usageCacheReadInputTokens = usage ? normalizeUsageInt(usage.cache_read_input_tokens) : null;
  const usageCacheCreationInputTokens = usage ? normalizeUsageInt(usage.cache_creation_input_tokens) : null;

  const blocks = Array.isArray(msg.content) ? msg.content : [];
  let textBuf = "";
  const flushText = () => {
    const t = normalizeString(textBuf);
    if (!t) return null;
    fullText += t;
    textBuf = "";
    nodeId += 1;
    return makeBackChatChunk({ text: t, nodes: [rawResponseNode({ id: nodeId, content: t })] });
  };

  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const bt = normalizeString(b.type);
    if (bt === "text" && typeof b.text === "string" && b.text) {
      textBuf += b.text;
      continue;
    }

    if (bt === "thinking") {
      const chunk = flushText();
      if (chunk) yield chunk;
      const thinking = normalizeString(b.thinking ?? b.summary ?? b.text);
      if (thinking) {
        nodeId += 1;
        yield makeBackChatChunk({ text: "", nodes: [thinkingNode({ id: nodeId, summary: thinking })] });
      }
      continue;
    }

    if (bt === "tool_use") {
      const chunk = flushText();
      if (chunk) yield chunk;
      const toolName = normalizeString(b.name);
      if (!toolName) continue;
      const inputJson = normalizeToolInputToJsonString(b.input);
      const built = buildToolUseChunks({
        nodeId,
        toolUseId: normalizeString(b.id),
        toolName,
        inputJson,
        meta: getToolMeta(toolName),
        supportToolUseStart
      });
      nodeId = built.nodeId;
      if (built.chunks.length) sawToolUse = true;
      for (const c of built.chunks) yield c;
      continue;
    }
  }

  const last = flushText();
  if (last) yield last;

  const usageBuilt = buildTokenUsageChunk({
    nodeId,
    inputTokens: usageInputTokens,
    outputTokens: usageOutputTokens,
    cacheReadInputTokens: usageCacheReadInputTokens,
    cacheCreationInputTokens: usageCacheCreationInputTokens
  });
  nodeId = usageBuilt.nodeId;
  if (usageBuilt.chunk) yield usageBuilt.chunk;

  const final = buildFinalChatChunk({ nodeId, fullText, stopReasonSeen, stopReason, sawToolUse });
  yield final.chunk;
}

module.exports = { extractTextFromAnthropicJson, emitAnthropicJsonAsAugmentChunks };
