"use strict";

const { normalizeString } = require("../../infra/util");
const shared = require("../augment-chat/shared");
const { sampleJsonFromSchema } = require("./schema-sample");
const { dedupeToolDefsByName } = require("./tool-defs");

function countSchemaProperties(schema) {
  const s = schema && typeof schema === "object" && !Array.isArray(schema) ? schema : null;
  const props = s && s.properties && typeof s.properties === "object" && !Array.isArray(s.properties) ? s.properties : null;
  return props ? Object.keys(props).length : 0;
}

function summarizeCapturedToolsSchemas(toolDefs) {
  const defs = dedupeToolDefsByName(toolDefs);
  let withMcpMeta = 0;
  let sampleOk = 0;
  const failed = [];

  for (const d of defs) {
    const name = normalizeString(d?.name);
    const schema = shared.resolveToolSchema(d);
    const hasMcp = Boolean(normalizeString(d?.mcp_server_name ?? d?.mcpServerName) || normalizeString(d?.mcp_tool_name ?? d?.mcpToolName));
    if (hasMcp) withMcpMeta += 1;
    try {
      const sample = sampleJsonFromSchema(schema, 0);
      JSON.stringify(sample);
      sampleOk += 1;
    } catch {
      if (name) failed.push(name);
    }
  }

  return { toolCount: defs.length, withMcpMeta, sampleOk, sampleFailedNames: failed.slice(0, 12), sampleFailedTruncated: failed.length > 12 };
}

function pickRealToolsForUsabilityProbe(toolDefs, { maxTools = 4 } = {}) {
  const defs = dedupeToolDefsByName(toolDefs);
  const max = Math.max(1, Number(maxTools) || 4);
  if (max >= defs.length) {
    return defs.slice().sort((a, b) => normalizeString(a?.name).localeCompare(normalizeString(b?.name)));
  }
  const byName = new Map(defs.map((d) => [normalizeString(d?.name), d]).filter((x) => x[0]));

  const chosen = [];
  const seen = new Set();
  const pickByName = (name) => {
    const k = normalizeString(name);
    const d = k ? byName.get(k) : null;
    if (!d || seen.has(k)) return false;
    seen.add(k);
    chosen.push(d);
    return true;
  };

  // 明确优先：覆盖常用 + 复杂 schema（如果存在）
  const preferredNames = ["str-replace-editor", "codebase-retrieval", "web-fetch", "web-search", "diagnostics"];
  for (const n of preferredNames) {
    if (chosen.length >= maxTools) break;
    pickByName(n);
  }

  // 覆盖 MCP meta（用于验证 mcp_server_name/mcp_tool_name 能回填到 tool_use）
  if (chosen.length < maxTools) {
    const mcp = defs.filter((d) => normalizeString(d?.mcp_server_name ?? d?.mcpServerName) || normalizeString(d?.mcp_tool_name ?? d?.mcpToolName));
    mcp.sort((a, b) => normalizeString(a?.name).localeCompare(normalizeString(b?.name)));
    for (const d of mcp) {
      if (chosen.length >= maxTools) break;
      pickByName(d.name);
    }
  }

  // 覆盖最大 properties（更容易触发 schema 边界）
  if (chosen.length < maxTools) {
    const ranked = defs
      .map((d) => ({ d, props: countSchemaProperties(shared.resolveToolSchema(d)) }))
      .sort((a, b) => b.props - a.props || normalizeString(a.d?.name).localeCompare(normalizeString(b.d?.name)));
    for (const it of ranked) {
      if (chosen.length >= maxTools) break;
      pickByName(it.d.name);
    }
  }

  // 最后兜底：按 name 排序补齐
  if (chosen.length < maxTools) {
    const sorted = defs.slice().sort((a, b) => normalizeString(a?.name).localeCompare(normalizeString(b?.name)));
    for (const d of sorted) {
      if (chosen.length >= maxTools) break;
      pickByName(d.name);
    }
  }

  return chosen.slice(0, max);
}

module.exports = { summarizeCapturedToolsSchemas, pickRealToolsForUsabilityProbe };
