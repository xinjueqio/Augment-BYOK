"use strict";

const shared = require("../../augment-chat/shared");
const { exchangeRequestNodes, exchangeResponseNodes } = require("../abridged");
const { REQUEST_NODE_TOOL_RESULT } = require("../../augment-protocol");

const { asRecord, asArray, asString, pick, normalizeNodeType } = shared;

function approxTokenCountFromByteLen(len) {
  const BYTES_PER_TOKEN = 4;
  return Math.ceil(Number(len) / BYTES_PER_TOKEN);
}

function estimateRequestExtraSizeChars(req) {
  const r = asRecord(req);
  return (
    asString(pick(r, ["prefix"])).length +
    asString(pick(r, ["selected_code", "selectedCode"])).length +
    asString(pick(r, ["suffix"])).length +
    asString(pick(r, ["diff"])).length
  );
}

function estimateNodeSizeChars(node) {
  const n = asRecord(node);
  let out = 16;
  out += asString(pick(n, ["content"])).length;
  out += asString(pick(pick(n, ["text_node", "textNode"]), ["content"])).length;
  const tr = asRecord(pick(n, ["tool_result_node", "toolResultNode"]));
  if (normalizeNodeType(n) === REQUEST_NODE_TOOL_RESULT) {
    out += asString(pick(tr, ["tool_use_id", "toolUseId"])).length;
    out += asString(pick(tr, ["content"])).length;
    for (const c of asArray(pick(tr, ["content_nodes", "contentNodes"]))) {
      const cr = asRecord(c);
      out += 8;
      out += asString(pick(cr, ["text_content", "textContent"])).length;
      const img = asRecord(pick(cr, ["image_content", "imageContent"]));
      out += asString(pick(img, ["image_data", "imageData"])).length;
    }
  }
  const img = asRecord(pick(n, ["image_node", "imageNode"]));
  out += asString(pick(img, ["image_data", "imageData"])).length;
  for (const v of [
    pick(n, ["image_id_node", "imageIdNode"]),
    pick(n, ["ide_state_node", "ideStateNode"]),
    pick(n, ["edit_events_node", "editEventsNode"]),
    pick(n, ["checkpoint_ref_node", "checkpointRefNode"]),
    pick(n, ["change_personality_node", "changePersonalityNode"]),
    pick(n, ["file_node", "fileNode"]),
    pick(n, ["file_id_node", "fileIdNode"]),
    pick(n, ["history_summary_node", "historySummaryNode"])
  ]) {
    if (v == null) continue;
    try {
      out += JSON.stringify(v).length;
    } catch {}
  }
  const tu = asRecord(pick(n, ["tool_use", "toolUse"]));
  out += asString(pick(tu, ["tool_use_id", "toolUseId"])).length;
  out += asString(pick(tu, ["tool_name", "toolName"])).length;
  out += asString(pick(tu, ["input_json", "inputJson"])).length;
  out += asString(pick(tu, ["mcp_server_name", "mcpServerName"])).length;
  out += asString(pick(tu, ["mcp_tool_name", "mcpToolName"])).length;
  const th = asRecord(pick(n, ["thinking", "thinking_node", "thinkingNode"]));
  out += asString(pick(th, ["summary"])).length;
  return out;
}

function estimateExchangeSizeChars(exchange) {
  const it = asRecord(exchange);
  const reqNodes = exchangeRequestNodes(it);
  const respNodes = exchangeResponseNodes(it);
  let n = 0;
  n += reqNodes.length ? reqNodes.map(estimateNodeSizeChars).reduce((a, b) => a + b, 0) : asString(it.request_message).length;
  n += respNodes.length ? respNodes.map(estimateNodeSizeChars).reduce((a, b) => a + b, 0) : asString(it.response_text).length;
  return n;
}

function estimateHistorySizeChars(history) {
  return asArray(history).map(estimateExchangeSizeChars).reduce((a, b) => a + b, 0);
}

module.exports = {
  approxTokenCountFromByteLen,
  estimateRequestExtraSizeChars,
  estimateExchangeSizeChars,
  estimateHistorySizeChars
};
