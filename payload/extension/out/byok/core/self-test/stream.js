"use strict";

const { normalizeString } = require("../../infra/util");
const { RESPONSE_NODE_TOOL_USE, RESPONSE_NODE_TOKEN_USAGE } = require("../augment-protocol");

async function collectChatStream(gen, { maxChunks = 500 } = {}) {
  const chunks = [];
  const nodes = [];
  let text = "";
  let stop_reason = null;
  for await (const ch of gen) {
    if (chunks.length >= maxChunks) break;
    chunks.push(ch);
    if (typeof ch?.text === "string" && ch.text) text += ch.text;
    if (Array.isArray(ch?.nodes)) nodes.push(...ch.nodes);
    if (ch && typeof ch === "object" && "stop_reason" in ch) stop_reason = ch.stop_reason;
  }
  return { chunks, nodes, text, stop_reason };
}

function extractToolUsesFromNodes(nodes) {
  const out = [];
  for (const n of Array.isArray(nodes) ? nodes : []) {
    const r = n && typeof n === "object" ? n : null;
    if (!r) continue;
    if (Number(r.type) !== RESPONSE_NODE_TOOL_USE) continue;
    const tu = r.tool_use && typeof r.tool_use === "object" ? r.tool_use : r.toolUse && typeof r.toolUse === "object" ? r.toolUse : null;
    const tool_use_id = normalizeString(tu?.tool_use_id ?? tu?.toolUseId);
    const tool_name = normalizeString(tu?.tool_name ?? tu?.toolName);
    const input_json = typeof (tu?.input_json ?? tu?.inputJson) === "string" ? (tu.input_json ?? tu.inputJson) : "";
    const mcp_server_name = normalizeString(tu?.mcp_server_name ?? tu?.mcpServerName);
    const mcp_tool_name = normalizeString(tu?.mcp_tool_name ?? tu?.mcpToolName);
    if (!tool_use_id || !tool_name) continue;
    out.push({ tool_use_id, tool_name, input_json, mcp_server_name, mcp_tool_name });
  }
  return out;
}

function extractTokenUsageFromNodes(nodes) {
  let last = null;
  for (const n of Array.isArray(nodes) ? nodes : []) {
    const r = n && typeof n === "object" ? n : null;
    if (!r) continue;
    if (Number(r.type) !== RESPONSE_NODE_TOKEN_USAGE) continue;
    const tu = r.token_usage && typeof r.token_usage === "object" ? r.token_usage : r.tokenUsage && typeof r.tokenUsage === "object" ? r.tokenUsage : null;
    if (!tu) continue;
    last = tu;
  }
  return last;
}

module.exports = { collectChatStream, extractToolUsesFromNodes, extractTokenUsageFromNodes };

