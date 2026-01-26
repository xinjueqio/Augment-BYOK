"use strict";

function normalizeOutputIndex(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function createOutputTextTracker() {
  const fullTextByOutputIndex = new Map();

  const pushDelta = (outputIndex, deltaRaw) => {
    const idx = normalizeOutputIndex(outputIndex);
    const delta = typeof deltaRaw === "string" ? deltaRaw : "";
    if (!delta) return { idx, delta: "" };
    fullTextByOutputIndex.set(idx, (fullTextByOutputIndex.get(idx) || "") + delta);
    return { idx, delta };
  };

  const applyFinalText = (outputIndex, fullTextRaw) => {
    const idx = normalizeOutputIndex(outputIndex);
    const full = typeof fullTextRaw === "string" ? fullTextRaw : "";
    if (!full) return { idx, rest: "" };

    const prev = fullTextByOutputIndex.get(idx) || "";
    if (!prev) {
      fullTextByOutputIndex.set(idx, full);
      return { idx, rest: full };
    }
    if (full.startsWith(prev)) {
      fullTextByOutputIndex.set(idx, full);
      return { idx, rest: full.slice(prev.length) };
    }
    return { idx, rest: "" };
  };

  return { pushDelta, applyFinalText };
}

module.exports = { normalizeOutputIndex, createOutputTextTracker };
