"use strict";

const { normalizeString } = require("../../infra/util");
const { ensureModelRegistryFeatureFlags } = require("../../core/model-registry");
const { makeModelInfo } = require("../../core/protocol");
const { joinBaseUrl, safeFetch } = require("../../providers/http");
const { readHttpErrorDetail } = require("../../providers/request-util");

async function fetchOfficialGetModels({ completionURL, apiToken, timeoutMs, abortSignal }) {
  const url = joinBaseUrl(normalizeString(completionURL), "get-models");
  if (!url) throw new Error("completionURL 无效（无法请求官方 get-models）");
  const headers = { "content-type": "application/json" };
  if (apiToken) headers.authorization = `Bearer ${apiToken}`;
  const resp = await safeFetch(url, { method: "POST", headers, body: "{}" }, { timeoutMs, abortSignal, label: "augment/get-models" });
  if (!resp.ok) throw new Error(`get-models ${resp.status}: ${await readHttpErrorDetail(resp, { maxChars: 300 })}`.trim());
  const json = await resp.json().catch(() => null);
  if (!json || typeof json !== "object") throw new Error("get-models 响应不是 JSON 对象");
  return json;
}

function mergeModels(upstreamJson, byokModelNames, opts) {
  const base = upstreamJson && typeof upstreamJson === "object" ? upstreamJson : {};
  const models = Array.isArray(base.models) ? base.models.slice() : [];
  const existing = new Set(models.map((m) => (m && typeof m.name === "string" ? m.name : "")).filter(Boolean));
  for (const name of byokModelNames) {
    if (!name || existing.has(name)) continue;
    models.push(makeModelInfo(name));
    existing.add(name);
  }
  const baseDefaultModel = typeof base.default_model === "string" && base.default_model ? base.default_model : (models[0]?.name || "unknown");
  const baseFlags = base.feature_flags && typeof base.feature_flags === "object" && !Array.isArray(base.feature_flags) ? base.feature_flags : {};
  const preferredDefaultModel = normalizeString(opts?.defaultModel);
  const defaultModel = preferredDefaultModel || baseDefaultModel;
  const flags = ensureModelRegistryFeatureFlags(baseFlags, { byokModelIds: byokModelNames, defaultModel, agentChatModel: defaultModel });
  return { ...base, default_model: defaultModel, models, feature_flags: flags };
}

module.exports = { fetchOfficialGetModels, mergeModels };

