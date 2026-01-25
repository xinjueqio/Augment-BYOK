"use strict";

const { warn } = require("../infra/log");
const { normalizeEndpoint, normalizeString, normalizeStringList } = require("../infra/util");
const { defaultConfig } = require("./default-config");

const UNSAFE_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isValidHistorySummaryTemplateNewMode(template) {
  const s = normalizeString(template);
  if (!s) return false;
  const required = [
    "{summary}",
    "{summarization_request_id}",
    "{beginning_part_dropped_num_exchanges}",
    "{middle_part_abridged}",
    "{end_part_full}"
  ];
  return required.every((p) => s.includes(p));
}

function get(obj, keys) {
  for (const k of keys) {
    if (obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

function normalizeMode(v) {
  const s = normalizeString(v);
  if (s === "byok" || s === "official" || s === "disabled") return s;
  return "";
}

function extractLegacyTelemetryDisabledEndpoints(raw) {
  const telemetry = get(raw, ["telemetry"]);
  const disabledEndpoints = get(telemetry, ["disabled_endpoints", "disabledEndpoints"]);
  return Array.isArray(disabledEndpoints) ? disabledEndpoints.map(normalizeEndpoint).filter(Boolean) : [];
}

function sanitizeUserJson(value, ctx) {
  const depth = ctx && typeof ctx === "object" ? Number(ctx.depth) : 0;
  const seen = ctx && typeof ctx === "object" && ctx.seen instanceof WeakMap ? ctx.seen : new WeakMap();

  if (value == null || typeof value !== "object") return value;
  if (depth >= 40) return null;
  if (seen.has(value)) return null;
  seen.set(value, true);

  if (Array.isArray(value)) return value.map((v) => sanitizeUserJson(v, { depth: depth + 1, seen }));

  const out = Object.create(null);
  for (const [k, v] of Object.entries(value)) {
    if (UNSAFE_JSON_KEYS.has(k)) continue;
    out[k] = sanitizeUserJson(v, { depth: depth + 1, seen });
  }
  return out;
}

function normalizeConfig(raw) {
  const out = defaultConfig();
  const safeRaw = sanitizeUserJson(raw, { depth: 0, seen: new WeakMap() });
  if (!safeRaw || typeof safeRaw !== "object" || Array.isArray(safeRaw)) return out;
  raw = safeRaw;

  const version = get(raw, ["version"]);
  if (Number.isFinite(Number(version)) && Number(version) > 0) out.version = Number(version);

  const official = get(raw, ["official"]);
  const completionUrl = normalizeString(get(official, ["completion_url", "completionUrl"]));
  if (completionUrl) out.official.completionUrl = completionUrl;
  const apiToken = normalizeString(get(official, ["api_token", "apiToken"]));
  if (apiToken) out.official.apiToken = apiToken;

  const legacyTelemetryDisabledEndpoints = extractLegacyTelemetryDisabledEndpoints(raw);

  const historySummary = get(raw, ["history_summary", "historySummary"]);
  if (historySummary && typeof historySummary === "object" && !Array.isArray(historySummary)) {
    const hs = out.historySummary;
    const enabled = get(historySummary, ["enabled"]);
    if (typeof enabled === "boolean") hs.enabled = enabled;
    const providerId = normalizeString(get(historySummary, ["provider_id", "providerId"]));
    if (providerId) hs.providerId = providerId;
    const model = normalizeString(get(historySummary, ["model"]));
    if (model) hs.model = model;
    const maxTokens = get(historySummary, ["max_tokens", "maxTokens"]);
    if (Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0) hs.maxTokens = Math.floor(Number(maxTokens));
    const timeoutSeconds = get(historySummary, ["timeout_seconds", "timeoutSeconds"]);
    if (Number.isFinite(Number(timeoutSeconds)) && Number(timeoutSeconds) > 0) hs.timeoutSeconds = Math.floor(Number(timeoutSeconds));
    const triggerOnHistorySizeChars = get(historySummary, ["trigger_on_history_size_chars", "triggerOnHistorySizeChars"]);
    if (Number.isFinite(Number(triggerOnHistorySizeChars)) && Number(triggerOnHistorySizeChars) > 0)
      hs.triggerOnHistorySizeChars = Math.floor(Number(triggerOnHistorySizeChars));
    const triggerStrategy = normalizeString(get(historySummary, ["trigger_strategy", "triggerStrategy"]));
    if (triggerStrategy) hs.triggerStrategy = triggerStrategy;
    const triggerOnContextRatio = get(historySummary, ["trigger_on_context_ratio", "triggerOnContextRatio"]);
    if (Number.isFinite(Number(triggerOnContextRatio)) && Number(triggerOnContextRatio) > 0) hs.triggerOnContextRatio = Number(triggerOnContextRatio);
    const targetContextRatio = get(historySummary, ["target_context_ratio", "targetContextRatio"]);
    if (Number.isFinite(Number(targetContextRatio)) && Number(targetContextRatio) > 0) hs.targetContextRatio = Number(targetContextRatio);
    const contextWindowTokensDefault = get(historySummary, ["context_window_tokens_default", "contextWindowTokensDefault"]);
    if (Number.isFinite(Number(contextWindowTokensDefault)) && Number(contextWindowTokensDefault) >= 0)
      hs.contextWindowTokensDefault = Math.floor(Number(contextWindowTokensDefault));
    const contextWindowTokensOverrides = get(historySummary, ["context_window_tokens_overrides", "contextWindowTokensOverrides"]);
    if (contextWindowTokensOverrides && typeof contextWindowTokensOverrides === "object" && !Array.isArray(contextWindowTokensOverrides))
      hs.contextWindowTokensOverrides = contextWindowTokensOverrides;
    const historyTailSizeCharsToExclude = get(historySummary, ["history_tail_size_chars_to_exclude", "historyTailSizeCharsToExclude"]);
    if (Number.isFinite(Number(historyTailSizeCharsToExclude)) && Number(historyTailSizeCharsToExclude) >= 0)
      hs.historyTailSizeCharsToExclude = Math.floor(Number(historyTailSizeCharsToExclude));
    const minTailExchanges = get(historySummary, ["min_tail_exchanges", "minTailExchanges"]);
    if (Number.isFinite(Number(minTailExchanges)) && Number(minTailExchanges) > 0) hs.minTailExchanges = Math.floor(Number(minTailExchanges));
    const cacheTtlMs = get(historySummary, ["cache_ttl_ms", "cacheTtlMs"]);
    if (Number.isFinite(Number(cacheTtlMs)) && Number(cacheTtlMs) >= 0) hs.cacheTtlMs = Math.floor(Number(cacheTtlMs));
    const maxSummarizationInputChars = get(historySummary, ["max_summarization_input_chars", "maxSummarizationInputChars"]);
    if (Number.isFinite(Number(maxSummarizationInputChars)) && Number(maxSummarizationInputChars) >= 0)
      hs.maxSummarizationInputChars = Math.floor(Number(maxSummarizationInputChars));
    const prompt = typeof get(historySummary, ["prompt"]) === "string" ? get(historySummary, ["prompt"]) : "";
    if (normalizeString(prompt)) hs.prompt = prompt;
    const rollingSummary = get(historySummary, ["rolling_summary", "rollingSummary"]);
    if (typeof rollingSummary === "boolean") hs.rollingSummary = rollingSummary;
    const template =
      typeof get(historySummary, ["summary_node_request_message_template", "summaryNodeRequestMessageTemplate"]) === "string"
        ? get(historySummary, ["summary_node_request_message_template", "summaryNodeRequestMessageTemplate"])
        : "";
    if (normalizeString(template)) {
      if (!isValidHistorySummaryTemplateNewMode(template)) {
        warn(
          "historySummary.summaryNodeRequestMessageTemplate 无效（要求包含 {summary}/{summarization_request_id}/{beginning_part_dropped_num_exchanges}/{middle_part_abridged}/{end_part_full}），将使用默认模板"
        );
      } else {
        hs.summaryNodeRequestMessageTemplate = template;
      }
    }
    const abridgedHistoryParams = get(historySummary, ["abridged_history_params", "abridgedHistoryParams"]);
    if (abridgedHistoryParams && typeof abridgedHistoryParams === "object" && !Array.isArray(abridgedHistoryParams)) {
      const p = hs.abridgedHistoryParams;
      const totalCharsLimit = get(abridgedHistoryParams, ["total_chars_limit", "totalCharsLimit"]);
      if (Number.isFinite(Number(totalCharsLimit)) && Number(totalCharsLimit) > 0) p.totalCharsLimit = Math.floor(Number(totalCharsLimit));
      const userMessageCharsLimit = get(abridgedHistoryParams, ["user_message_chars_limit", "userMessageCharsLimit"]);
      if (Number.isFinite(Number(userMessageCharsLimit)) && Number(userMessageCharsLimit) > 0) p.userMessageCharsLimit = Math.floor(Number(userMessageCharsLimit));
      const agentResponseCharsLimit = get(abridgedHistoryParams, ["agent_response_chars_limit", "agentResponseCharsLimit"]);
      if (Number.isFinite(Number(agentResponseCharsLimit)) && Number(agentResponseCharsLimit) > 0) p.agentResponseCharsLimit = Math.floor(Number(agentResponseCharsLimit));
      const actionCharsLimit = get(abridgedHistoryParams, ["action_chars_limit", "actionCharsLimit"]);
      if (Number.isFinite(Number(actionCharsLimit)) && Number(actionCharsLimit) > 0) p.actionCharsLimit = Math.floor(Number(actionCharsLimit));
      const numFilesModifiedLimit = get(abridgedHistoryParams, ["num_files_modified_limit", "numFilesModifiedLimit"]);
      if (Number.isFinite(Number(numFilesModifiedLimit)) && Number(numFilesModifiedLimit) > 0) p.numFilesModifiedLimit = Math.floor(Number(numFilesModifiedLimit));
      const numFilesCreatedLimit = get(abridgedHistoryParams, ["num_files_created_limit", "numFilesCreatedLimit"]);
      if (Number.isFinite(Number(numFilesCreatedLimit)) && Number(numFilesCreatedLimit) > 0) p.numFilesCreatedLimit = Math.floor(Number(numFilesCreatedLimit));
      const numFilesDeletedLimit = get(abridgedHistoryParams, ["num_files_deleted_limit", "numFilesDeletedLimit"]);
      if (Number.isFinite(Number(numFilesDeletedLimit)) && Number(numFilesDeletedLimit) > 0) p.numFilesDeletedLimit = Math.floor(Number(numFilesDeletedLimit));
      const numFilesViewedLimit = get(abridgedHistoryParams, ["num_files_viewed_limit", "numFilesViewedLimit"]);
      if (Number.isFinite(Number(numFilesViewedLimit)) && Number(numFilesViewedLimit) > 0) p.numFilesViewedLimit = Math.floor(Number(numFilesViewedLimit));
      const numTerminalCommandsLimit = get(abridgedHistoryParams, ["num_terminal_commands_limit", "numTerminalCommandsLimit"]);
      if (Number.isFinite(Number(numTerminalCommandsLimit)) && Number(numTerminalCommandsLimit) > 0) p.numTerminalCommandsLimit = Math.floor(Number(numTerminalCommandsLimit));
    }
  }

  const routing = get(raw, ["routing"]);

  const rules = get(routing, ["rules"]);
  if (rules && typeof rules === "object" && !Array.isArray(rules)) {
    for (const [k, v] of Object.entries(rules)) {
      const ep = normalizeEndpoint(k);
      if (!ep) continue;
      const hadDefault = Object.prototype.hasOwnProperty.call(out.routing.rules, ep);
      const mode = normalizeMode(get(v, ["mode"])) || "official";
      let providerId = normalizeString(get(v, ["provider_id", "providerId"]));
      let model = normalizeString(get(v, ["model"]));
      if (mode !== "byok") {
        providerId = "";
        model = "";
      }
      if (!hadDefault && mode === "official" && !providerId && !model) continue;
      out.routing.rules[ep] = { mode, providerId, model };
    }
  }

  // legacy: telemetry.disabledEndpoints（已弃用）→ routing.rules[*].mode=disabled
  // 需要覆盖 rules 中显式设置，以保持旧语义（telemetry 优先级更高）。
  if (legacyTelemetryDisabledEndpoints.length) {
    out.routing = out.routing && typeof out.routing === "object" ? out.routing : {};
    out.routing.rules = out.routing.rules && typeof out.routing.rules === "object" ? out.routing.rules : {};
    for (const ep of legacyTelemetryDisabledEndpoints) {
      if (!ep) continue;
      const r =
        out.routing.rules[ep] && typeof out.routing.rules[ep] === "object" ? out.routing.rules[ep] : (out.routing.rules[ep] = {});
      r.mode = "disabled";
      r.providerId = "";
      r.model = "";
    }
  }

  const providers = get(raw, ["providers"]);
  if (Array.isArray(providers)) {
    out.providers = providers
      .map((p) => {
        if (!p || typeof p !== "object" || Array.isArray(p)) return null;
        const id = normalizeString(get(p, ["id"]));
        const type = normalizeString(get(p, ["type"]));
        const baseUrl = normalizeString(get(p, ["base_url", "baseUrl"]));
        const apiKey = normalizeString(get(p, ["api_key", "apiKey"]));
        const defaultModel = normalizeString(get(p, ["default_model", "defaultModel"]));
        const models = normalizeStringList(get(p, ["models"]), { maxItems: 10000 });
        const headers = get(p, ["headers"]);
        const requestDefaults = get(p, ["request_defaults", "requestDefaults"]);
        if (!id || !type) return null;

        const finalModels = models.length ? models : defaultModel ? [defaultModel] : [];
        const finalDefaultModel = defaultModel || finalModels[0] || "";

        return {
          id,
          type,
          baseUrl,
          apiKey,
          models: finalModels,
          defaultModel: finalDefaultModel,
          headers: headers && typeof headers === "object" && !Array.isArray(headers) ? headers : {},
          requestDefaults: requestDefaults && typeof requestDefaults === "object" && !Array.isArray(requestDefaults) ? requestDefaults : {}
        };
      })
      .filter(Boolean);
  }

  return out;
}

module.exports = { normalizeConfig, extractLegacyTelemetryDisabledEndpoints };

