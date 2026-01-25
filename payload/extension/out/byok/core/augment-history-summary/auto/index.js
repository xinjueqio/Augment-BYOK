"use strict";

const { debug } = require("../../../infra/log");
const { normalizeString } = require("../../../infra/util");
const shared = require("../../augment-chat/shared");
const { buildAbridgedHistoryText, exchangeRequestNodes, exchangeResponseNodes } = require("../abridged");
const { REQUEST_NODE_HISTORY_SUMMARY } = require("../../augment-protocol");
const {
  setHistorySummaryStorage,
  cacheGetFresh,
  cacheGetFreshState,
  cachePut,
  deleteHistorySummaryCache,
  clearHistorySummaryCacheAll
} = require("../cache");
const { runSummaryModelOnce } = require("../provider-dispatch");

const { approxTokenCountFromByteLen, estimateRequestExtraSizeChars, estimateHistorySizeChars } = require("./estimate");
const { resolveContextWindowTokens, resolveHistorySummaryConfig, pickProviderById } = require("./config");
const { computeTailSelection } = require("./tail-selection");

const { asRecord, asArray, asString, pick, normalizeNodeType } = shared;

function nowMs() {
  return Date.now();
}

function hasHistorySummaryNode(nodes) {
  return asArray(nodes).some(
    (n) =>
      normalizeNodeType(n) === REQUEST_NODE_HISTORY_SUMMARY &&
      pick(n, ["history_summary_node", "historySummaryNode"]) != null
  );
}

function historyContainsSummary(history) {
  return asArray(history).some((h) => {
    const it = asRecord(h);
    return hasHistorySummaryNode(it.request_nodes) || hasHistorySummaryNode(it.structured_request_nodes) || hasHistorySummaryNode(it.nodes);
  });
}

function requestContainsSummary(req) {
  const r = asRecord(req);
  const nodes = [...asArray(r.nodes), ...asArray(r.structured_request_nodes), ...asArray(r.request_nodes)];
  return hasHistorySummaryNode(nodes);
}

function computeTriggerDecision({ hs, requestedModel, totalWithExtra, convId }) {
  const triggerOnHistorySizeChars = Number(hs.triggerOnHistorySizeChars);
  const baseDecision = { thresholdChars: triggerOnHistorySizeChars, tailExcludeChars: hs.historyTailSizeCharsToExclude };
  const strategy = normalizeString(hs.triggerStrategy).toLowerCase();
  if (strategy === "chars") return totalWithExtra >= triggerOnHistorySizeChars ? baseDecision : null;

  const cwTokensRaw = resolveContextWindowTokens(hs, requestedModel);
  const cwTokens =
    strategy === "auto" && cwTokensRaw ? Math.min(cwTokensRaw, Math.max(0, Math.floor(triggerOnHistorySizeChars / 4))) : cwTokensRaw;
  if ((strategy === "ratio" || strategy === "auto") && cwTokens) {
    const approxTotalTokens = approxTokenCountFromByteLen(totalWithExtra);
    const ratio = cwTokens ? approxTotalTokens / cwTokens : 0;
    const triggerRatio = Number(hs.triggerOnContextRatio) || 0.7;
    if (ratio < triggerRatio) return null;
    const targetRatio = Number(hs.targetContextRatio) || 0.55;
    const thresholdTokens = Math.ceil(cwTokens * triggerRatio);
    const thresholdChars = thresholdTokens * 4;
    const targetTokens = Math.floor(cwTokens * targetRatio);
    const targetCharsBudget = targetTokens * 4;
    const summaryOverhead = (Number(hs.abridgedHistoryParams?.totalCharsLimit) || 0) + (Number(hs.maxTokens) || 0) * 4 + 4096;
    const tailExcludeChars = Math.max(0, targetCharsBudget - summaryOverhead);
    debug(
      `historySummary trigger ratio: conv=${convId} model=${normalizeString(requestedModel)} tokens≈${approxTotalTokens}/${cwTokens} ratio≈${ratio.toFixed(3)}`
    );
    return { thresholdChars, tailExcludeChars };
  }

  return totalWithExtra >= triggerOnHistorySizeChars ? baseDecision : null;
}

async function resolveSummaryText({
  hs,
  cfg,
  convId,
  boundaryRequestId,
  history,
  tailStart,
  droppedHead,
  fallbackProvider,
  fallbackModel,
  timeoutMs,
  abortSignal
}) {
  const now = nowMs();
  const cached = cacheGetFresh(convId, boundaryRequestId, now, hs.cacheTtlMs);
  if (cached) return { summaryText: cached.summaryText, summarizationRequestId: cached.summarizationRequestId, now };

  const provider = pickProviderById(cfg, hs.providerId) || fallbackProvider;
  const model = normalizeString(hs.model) || normalizeString(fallbackModel);
  let prompt = asString(hs.prompt);
  let inputHistory = droppedHead.slice();

  let usedRolling = false;
  if (hs.rollingSummary === true) {
    const prev = cacheGetFreshState(convId, now, hs.cacheTtlMs);
    if (
      prev &&
      normalizeString(prev.summarizedUntilRequestId) &&
      normalizeString(prev.summarizedUntilRequestId) !== boundaryRequestId
    ) {
      const prevBoundaryPos = history.findIndex(
        (h) => normalizeString(h?.request_id) === normalizeString(prev.summarizedUntilRequestId)
      );
      if (prevBoundaryPos >= 0 && prevBoundaryPos < tailStart) {
        const delta = history.slice(prevBoundaryPos, tailStart);
        if (delta.length) {
          const prevExchange = {
            request_id: "byok_history_summary_prev",
            request_message: `[PREVIOUS_SUMMARY]\n${asString(prev.summaryText).trim()}\n[/PREVIOUS_SUMMARY]`,
            response_text: "",
            request_nodes: [],
            structured_request_nodes: [],
            nodes: [],
            response_nodes: [],
            structured_output_nodes: []
          };
          inputHistory = [prevExchange, ...delta];
          usedRolling = true;
          prompt = `${normalizeString(hs.prompt)}\n\nYou will be given an existing summary and additional new conversation turns. Update the summary to include the new information. Output only the updated summary.`;
        }
      }
    }
  }

  const maxIn = Number(hs.maxSummarizationInputChars) || 0;
  if (maxIn > 0) {
    const shrink = () => estimateHistorySizeChars(inputHistory) > maxIn;
    if (usedRolling) while (inputHistory.length > 1 && shrink()) inputHistory.splice(1, 1);
    else while (inputHistory.length && shrink()) inputHistory.shift();
  }
  if (!inputHistory.length) return null;

  const timeout = Math.min(Math.max(1000, Number(timeoutMs) || 120000), hs.timeoutSeconds * 1000);
  const summaryText = normalizeString(
    await runSummaryModelOnce({ provider, model, prompt, chatHistory: inputHistory, maxTokens: hs.maxTokens, timeoutMs: timeout, abortSignal })
  );
  if (!summaryText) return null;
  const summarizationRequestId = `byok_history_summary_${now}`;
  await cachePut(convId, boundaryRequestId, summaryText, summarizationRequestId, now);
  return { summaryText, summarizationRequestId, now };
}

function buildHistoryEnd(tail) {
  return asArray(tail).map((h) => {
    const it = asRecord(h);
    return {
      request_id: it.request_id,
      request_message: it.request_message,
      response_text: it.response_text,
      request_nodes: exchangeRequestNodes(it),
      response_nodes: exchangeResponseNodes(it)
    };
  });
}

function injectHistorySummaryNodeIntoRequestNodes({ hs, req, tail, summaryText, summarizationRequestId, abridged }) {
  const template = asString(hs.summaryNodeRequestMessageTemplate);
  const historyEnd = buildHistoryEnd(tail);
  const summaryNode = {
    summary_text: summaryText,
    summarization_request_id: summarizationRequestId,
    history_beginning_dropped_num_exchanges: abridged.droppedBeginning,
    history_middle_abridged_text: abridged.text,
    history_end: historyEnd,
    message_template: template
  };
  const node = { id: 0, type: REQUEST_NODE_HISTORY_SUMMARY, content: "", history_summary_node: summaryNode };
  const r = req && typeof req === "object" ? req : null;
  if (!r) return null;
  if (!Array.isArray(r.request_nodes)) r.request_nodes = [];
  r.request_nodes.push(node);
  return node;
}

async function maybeSummarizeAndCompactAugmentChatRequest({
  cfg,
  req,
  requestedModel,
  fallbackProvider,
  fallbackModel,
  timeoutMs,
  abortSignal
}) {
  const hs = resolveHistorySummaryConfig(cfg);
  if (!hs) return false;
  const convId = normalizeString(req?.conversation_id);
  if (!convId) return false;
  const history = asArray(req?.chat_history);
  if (!history.length) return false;
  if (historyContainsSummary(history)) return false;
  if (requestContainsSummary(req)) return false;

  const totalChars = estimateHistorySizeChars(history);
  const totalWithExtra = totalChars + asString(req?.message).length + estimateRequestExtraSizeChars(req);
  const decision = computeTriggerDecision({ hs, requestedModel, totalWithExtra, convId });
  if (!decision) return false;

  const sel = computeTailSelection({ history, hs, decision });
  if (!sel) return false;

  const abridged = buildAbridgedHistoryText(history, hs.abridgedHistoryParams, sel.boundaryRequestId);
  const summary = await resolveSummaryText({
    hs,
    cfg,
    convId,
    boundaryRequestId: sel.boundaryRequestId,
    history,
    tailStart: sel.tailStart,
    droppedHead: sel.droppedHead,
    fallbackProvider,
    fallbackModel,
    timeoutMs,
    abortSignal
  });
  if (!summary) return false;

  const injected = injectHistorySummaryNodeIntoRequestNodes({
    hs,
    req,
    tail: sel.tail,
    summaryText: summary.summaryText,
    summarizationRequestId: summary.summarizationRequestId,
    abridged
  });
  if (!injected) return false;

  debug(`historySummary injected: conv=${convId} before≈${totalChars} tailStart=${sel.tailStart}`);
  return true;
}

module.exports = { setHistorySummaryStorage, maybeSummarizeAndCompactAugmentChatRequest, deleteHistorySummaryCache, clearHistorySummaryCacheAll };
