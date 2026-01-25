"use strict";

const { normalizeString } = require("../../../infra/util");

function summarizeToolResult(res, { maxLen = 180 } = {}) {
  const isError = Boolean(res?.isError ?? res?.is_error);
  const text = typeof res?.text === "string" ? res.text : res?.text != null ? String(res.text) : "";
  const s = text.trim();
  const lim = Number.isFinite(Number(maxLen)) && Number(maxLen) > 0 ? Math.floor(Number(maxLen)) : 180;
  const preview = s.length > lim ? s.slice(0, lim) + "…" : s;
  const extraKeys = res && typeof res === "object" ? Object.keys(res).filter((k) => !["text", "isError", "is_error"].includes(k)).slice(0, 6) : [];
  return { isError, text: s, preview, extraKeys };
}

function extractReferenceIdFromText(text) {
  const s = normalizeString(text);
  if (!s) return "";
  const patterns = [
    /reference_id\s*[:=]\s*['"]?([A-Za-z0-9_-]{4,})['"]?/i,
    /reference id\s*[:=]\s*['"]?([A-Za-z0-9_-]{4,})['"]?/i,
    /reference-id\s*[:=]\s*['"]?([A-Za-z0-9_-]{4,})['"]?/i,
    /referenceId\s*[:=]\s*['"]?([A-Za-z0-9_-]{4,})['"]?/i,
    /<reference[_-]?id>\s*([A-Za-z0-9_-]{4,})\s*<\/reference[_-]?id>/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) return String(m[1]).trim();
  }
  return "";
}

function extractReferenceIdFromToolResult(res) {
  const root = res && typeof res === "object" ? res : null;
  if (!root) return "";

  const directCandidates = [
    root.reference_id,
    root.referenceId,
    root.reference,
    root.ref_id,
    root.refId,
    root.untruncated_reference_id,
    root.untruncatedReferenceId
  ];
  for (const v of directCandidates) {
    const s = normalizeString(v);
    if (s) return s;
  }

  const fromText = extractReferenceIdFromText(root?.text);
  if (fromText) return fromText;

  const seen = new Set();
  const q = [{ v: root, d: 0 }];
  while (q.length) {
    const cur = q.shift();
    const v = cur?.v;
    const d = Number(cur?.d) || 0;
    if (!v || typeof v !== "object") continue;
    if (seen.has(v)) continue;
    seen.add(v);
    if (d > 6 || seen.size > 3000) break;

    for (const [k, child] of Object.entries(v)) {
      if (!child) continue;
      const key = normalizeString(k).toLowerCase();
      if (key.includes("reference") && (typeof child === "string" || typeof child === "number")) {
        const s = normalizeString(child);
        if (s) return s;
      }
      if (typeof child === "object") q.push({ v: child, d: d + 1 });
    }
  }

  return "";
}

function extractTerminalIdsFromText(text) {
  const s = normalizeString(text);
  if (!s) return [];
  const out = [];
  const re = /Terminal\s+(\d+)/gi;
  for (const m of s.matchAll(re)) {
    const n = Number(m?.[1]);
    if (Number.isFinite(n)) out.push(Math.floor(n));
  }
  return out;
}

function extractTerminalIdsFromToolResult(res) {
  const root = res && typeof res === "object" ? res : null;
  if (!root) return [];

  const ids = new Set();
  for (const n of extractTerminalIdsFromText(root?.text)) ids.add(n);

  const tryAdd = (v) => {
    const n = typeof v === "string" ? Number(v.trim()) : Number(v);
    if (Number.isFinite(n) && n >= 0) ids.add(Math.floor(n));
  };

  // 常见字段
  tryAdd(root?.terminal_id);
  tryAdd(root?.terminalId);
  tryAdd(root?.terminal);
  tryAdd(root?.terminalID);

  // 递归扫描：只在 key 名包含 terminal 时提取数字，避免误伤
  const seen = new Set();
  const q = [{ v: root, d: 0 }];
  while (q.length) {
    const cur = q.shift();
    const v = cur?.v;
    const d = Number(cur?.d) || 0;
    if (!v || typeof v !== "object") continue;
    if (seen.has(v)) continue;
    seen.add(v);
    if (d > 6 || seen.size > 2000) break;

    for (const [k, child] of Object.entries(v)) {
      if (!child) continue;
      const key = normalizeString(k).toLowerCase();
      if (key.includes("terminal")) {
        if (typeof child === "number" || typeof child === "string") tryAdd(child);
      }
      if (typeof child === "object") q.push({ v: child, d: d + 1 });
    }
  }

  return Array.from(ids.values()).sort((a, b) => a - b);
}

function findTaskUuidInPlan(plan, predicate) {
  const root = plan && typeof plan === "object" ? plan : null;
  if (!root) return "";
  const seen = new Set();
  const q = [root];
  while (q.length) {
    const cur = q.shift();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const uuid = normalizeString(cur.uuid);
    const name = normalizeString(cur.name);
    if (uuid && typeof predicate === "function" && predicate({ uuid, name, node: cur })) return uuid;
    const subs = Array.isArray(cur.subTasksData) ? cur.subTasksData : Array.isArray(cur.sub_tasks_data) ? cur.sub_tasks_data : [];
    for (const st of subs) q.push(st);
  }
  return "";
}

module.exports = {
  summarizeToolResult,
  extractReferenceIdFromText,
  extractReferenceIdFromToolResult,
  extractTerminalIdsFromText,
  extractTerminalIdsFromToolResult,
  findTaskUuidInPlan
};
