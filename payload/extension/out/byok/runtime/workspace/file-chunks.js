"use strict";

const { normalizeString, normalizeStringList } = require("../../infra/util");
const { normalizeOfficialBlobsDiff } = require("../../core/blob-utils");

function buildWorkspaceFileChunk(blobName, { charStart = 0, charEnd = 1 } = {}) {
  const b = normalizeString(blobName);
  if (!b) return null;
  const cs = Number.isFinite(Number(charStart)) && Number(charStart) >= 0 ? Math.floor(Number(charStart)) : 0;
  const ce = Number.isFinite(Number(charEnd)) && Number(charEnd) > cs ? Math.floor(Number(charEnd)) : cs + 1;
  return { char_start: cs, char_end: ce, blob_name: b };
}

function deriveWorkspaceFileChunksFromRequest(req, { maxChunks = 80 } = {}) {
  const r = req && typeof req === "object" ? req : {};
  const max = Number.isFinite(Number(maxChunks)) && Number(maxChunks) > 0 ? Math.floor(Number(maxChunks)) : 80;

  const names = [];
  names.push(...normalizeStringList(r.user_guided_blobs, { maxItems: max }));

  const diff = normalizeOfficialBlobsDiff(r.blobs);
  if (diff) names.push(...normalizeStringList(diff.added_blobs, { maxItems: max * 4 }));

  const seen = new Set();
  const out = [];
  for (const n of names) {
    const s = normalizeString(n);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    const chunk = buildWorkspaceFileChunk(s, { charStart: 0, charEnd: 1 });
    if (chunk) out.push(chunk);
    if (out.length >= max) break;
  }

  return out;
}

module.exports = { deriveWorkspaceFileChunksFromRequest };
