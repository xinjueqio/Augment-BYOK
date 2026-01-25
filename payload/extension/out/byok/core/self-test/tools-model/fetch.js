"use strict";

const { debug } = require("../../../infra/log");
const { nowMs } = require("../../../infra/trace");
const { normalizeString } = require("../../../infra/util");

const { getByokUpstreamGlobals, getToolsModelFromUpstreamOrNull, isToolsModelCandidate } = require("./globals");

async function fetchLocalToolDefinitionsFromUpstream({ timeoutMs, abortSignal, log } = {}) {
  const emit = (line) => {
    try {
      if (typeof log === "function") log(String(line || ""));
    } catch {}
  };

  const { upstream } = getByokUpstreamGlobals();
  const maybeExt = upstream?.augmentExtension;
  const direct = upstream?.toolsModel;
  const toolsModel = getToolsModelFromUpstreamOrNull();

  if (!isToolsModelCandidate(toolsModel)) {
    debug("[self-test] upstream toolsModel not exposed/found");
    return { ok: false, detail: "upstream toolsModel not exposed/found" };
  }

  // 这里不做超时强杀（工具定义拉取通常较快）；由外层 Self Test abortSignal 兜底。
  const defsRaw = await toolsModel.getToolDefinitions();
  const list = Array.isArray(defsRaw) ? defsRaw : [];
  const defs = [];
  const seen = new Set();
  for (const it of list) {
    const def = it && typeof it === "object" ? it.definition ?? it.toolDefinition ?? it : null;
    if (!def || typeof def !== "object") continue;
    const name = normalizeString(def?.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    defs.push(def);
  }

  const count = defs.length;
  if (!count) {
    emit("[captured tools] upstream toolsModel.getToolDefinitions 返回空列表（可能未初始化/无可用工具/或上游变更）");
    debug("[self-test] upstream toolsModel.getToolDefinitions empty list");
    return { ok: false, detail: "empty list" };
  }
  debug(`[self-test] upstream toolsModel.getToolDefinitions ok tools=${count}`);

  return {
    ok: true,
    toolsModel,
    defs,
    detail: `tools=${count}`,
    meta: {
      source: "upstream(toolsModel)",
      count,
      capturedAtMs: nowMs(),
      // 可选：方便排查（不是严格契约）
      hasAugmentExtensionRef: Boolean(maybeExt),
      hasDirectToolsModelRef: Boolean(direct)
    }
  };
}

module.exports = { fetchLocalToolDefinitionsFromUpstream };
