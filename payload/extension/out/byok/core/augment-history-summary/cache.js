"use strict";

const { debug } = require("../../infra/log");
const { normalizeString } = require("../../infra/util");
const { asString } = require("../augment-chat/shared");

const HISTORY_SUMMARY_CACHE_KEY = "augment-byok.historySummaryCache.v1";
const HISTORY_SUMMARY_CACHE = new Map();
let historySummaryCacheLoaded = false;
let historySummaryStorage = null;

function nowMs() {
  return Date.now();
}

function setHistorySummaryStorage(storage) {
  historySummaryStorage = storage && typeof storage === "object" ? storage : null;
  HISTORY_SUMMARY_CACHE.clear();
  historySummaryCacheLoaded = false;
  return Boolean(historySummaryStorage);
}

function resolveHistorySummaryStorage() {
  const s = historySummaryStorage && typeof historySummaryStorage === "object" ? historySummaryStorage : null;
  return s;
}

function maybeLoadHistorySummaryCacheFromStorage() {
  if (historySummaryCacheLoaded) return true;
  const storage = resolveHistorySummaryStorage();
  if (!storage || typeof storage.get !== "function") return false;

  try {
    const raw = storage.get(HISTORY_SUMMARY_CACHE_KEY);
    const root = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
    const entries =
      (root && root.entries && typeof root.entries === "object" && !Array.isArray(root.entries) ? root.entries : null) ||
      (root && typeof root === "object" ? root : null) ||
      null;
    if (entries) {
      for (const [cid, v] of Object.entries(entries)) {
        const convId = normalizeString(cid);
        const rec = v && typeof v === "object" && !Array.isArray(v) ? v : null;
        if (!convId || !rec) continue;
        const summaryText = asString(rec.summaryText ?? rec.summary_text);
        const summarizedUntilRequestId = asString(rec.summarizedUntilRequestId ?? rec.summarized_until_request_id);
        const summarizationRequestId = asString(rec.summarizationRequestId ?? rec.summarization_request_id);
        const updatedAtMs = Number(rec.updatedAtMs ?? rec.updated_at_ms) || 0;
        if (!summarizedUntilRequestId) continue;
        HISTORY_SUMMARY_CACHE.set(convId, { summaryText, summarizedUntilRequestId, summarizationRequestId, updatedAtMs });
      }
    }
    historySummaryCacheLoaded = true;
    debug(`historySummary cache loaded: entries=${HISTORY_SUMMARY_CACHE.size}`);
    return true;
  } catch (err) {
    debug(`historySummary cache load failed (ignored): ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function persistHistorySummaryCacheToStorage() {
  const storage = resolveHistorySummaryStorage();
  if (!storage || typeof storage.update !== "function") return false;

  const entries = {};
  for (const [cid, v] of HISTORY_SUMMARY_CACHE.entries()) {
    entries[cid] = {
      summaryText: asString(v?.summaryText),
      summarizedUntilRequestId: asString(v?.summarizedUntilRequestId),
      summarizationRequestId: asString(v?.summarizationRequestId),
      updatedAtMs: Number(v?.updatedAtMs) || 0
    };
  }
  try {
    await storage.update(HISTORY_SUMMARY_CACHE_KEY, { version: 1, entries });
    return true;
  } catch (err) {
    debug(`historySummary cache persist failed (ignored): ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function cacheGetFresh(conversationId, boundaryRequestId, now, ttlMs) {
  maybeLoadHistorySummaryCacheFromStorage();
  const cid = normalizeString(conversationId);
  const bid = normalizeString(boundaryRequestId);
  if (!cid || !bid) return null;
  const e = HISTORY_SUMMARY_CACHE.get(cid);
  if (!e) return null;
  if (ttlMs > 0 && now - Number(e.updatedAtMs || 0) > ttlMs) return null;
  if (normalizeString(e.summarizedUntilRequestId) !== bid) return null;
  return { summaryText: asString(e.summaryText), summarizationRequestId: asString(e.summarizationRequestId) };
}

function cacheGetFreshState(conversationId, now, ttlMs) {
  maybeLoadHistorySummaryCacheFromStorage();
  const cid = normalizeString(conversationId);
  if (!cid) return null;
  const e = HISTORY_SUMMARY_CACHE.get(cid);
  if (!e) return null;
  if (ttlMs > 0 && now - Number(e.updatedAtMs || 0) > ttlMs) return null;
  return { ...e };
}

async function cachePut(conversationId, boundaryRequestId, summaryText, summarizationRequestId, now) {
  maybeLoadHistorySummaryCacheFromStorage();
  const cid = normalizeString(conversationId);
  const bid = normalizeString(boundaryRequestId);
  if (!cid || !bid) return;
  HISTORY_SUMMARY_CACHE.set(cid, {
    summaryText: asString(summaryText),
    summarizedUntilRequestId: bid,
    summarizationRequestId: asString(summarizationRequestId),
    updatedAtMs: Number(now) || nowMs()
  });
  await persistHistorySummaryCacheToStorage();
}

async function deleteHistorySummaryCache(conversationId) {
  maybeLoadHistorySummaryCacheFromStorage();
  const cid = normalizeString(conversationId);
  if (!cid) return false;
  const existed = HISTORY_SUMMARY_CACHE.delete(cid);
  if (!existed) return false;
  await persistHistorySummaryCacheToStorage();
  return true;
}

async function clearHistorySummaryCacheAll() {
  maybeLoadHistorySummaryCacheFromStorage();
  const n = HISTORY_SUMMARY_CACHE.size;
  if (!n) return 0;
  HISTORY_SUMMARY_CACHE.clear();
  await persistHistorySummaryCacheToStorage();
  return n;
}

module.exports = {
  setHistorySummaryStorage,
  cacheGetFresh,
  cacheGetFreshState,
  cachePut,
  deleteHistorySummaryCache,
  clearHistorySummaryCacheAll
};
