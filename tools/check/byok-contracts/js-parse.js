"use strict";

const { assert, escapeRegExp } = require("./util");

function findMatchingParen(src, openParenIdx) {
  assert(openParenIdx >= 0 && openParenIdx < src.length && src[openParenIdx] === "(", "findMatchingParen: openParenIdx invalid");
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openParenIdx + 1; i < src.length; i++) {
    const ch = src[i];
    const next = i + 1 < src.length ? src[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "\"") inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`") inTemplate = false;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === "\"") {
      inDouble = true;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      continue;
    }

    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevelCommaList(src) {
  const s = typeof src === "string" ? src : "";
  const out = [];
  let start = 0;

  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = i + 1 < s.length ? s[i + 1] : "";

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "\"") inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`") inTemplate = false;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === "\"") {
      inDouble = true;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      continue;
    }

    if (ch === "(") {
      paren += 1;
      continue;
    }
    if (ch === ")") {
      paren = Math.max(0, paren - 1);
      continue;
    }
    if (ch === "{") {
      brace += 1;
      continue;
    }
    if (ch === "}") {
      brace = Math.max(0, brace - 1);
      continue;
    }
    if (ch === "[") {
      bracket += 1;
      continue;
    }
    if (ch === "]") {
      bracket = Math.max(0, bracket - 1);
      continue;
    }

    if (ch === "," && paren === 0 && brace === 0 && bracket === 0) {
      out.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }

  const last = s.slice(start).trim();
  if (last) out.push(last);
  return out;
}

function extractParamName(param) {
  const raw = String(param ?? "").trim();
  if (!raw) return "";
  const noRest = raw.startsWith("...") ? raw.slice(3).trim() : raw;
  const eq = noRest.indexOf("=");
  const lhs = (eq >= 0 ? noRest.slice(0, eq) : noRest).trim();
  return /^[A-Za-z_$][\w$]*$/.test(lhs) ? lhs : "";
}

function findAsyncMethodParams(src, methodName, { mustInclude } = {}) {
  const code = typeof src === "string" ? src : "";
  const out = [];
  const re = new RegExp(`\\basync\\s+${escapeRegExp(methodName)}\\s*\\(`, "g");
  for (const m of code.matchAll(re)) {
    const start = Number(m.index);
    if (!Number.isFinite(start) || start < 0) continue;
    const openParen = code.indexOf("(", start);
    if (openParen < 0) continue;
    const closeParen = findMatchingParen(code, openParen);
    if (closeParen < 0) continue;
    const paramsText = code.slice(openParen + 1, closeParen);
    const params = splitTopLevelCommaList(paramsText);
    const names = params.map(extractParamName);
    if (mustInclude) {
      const window = code.slice(start, Math.min(code.length, start + 3000));
      if (!window.includes(mustInclude)) continue;
    }
    out.push({ start, paramsText, params, names });
  }
  return out;
}

module.exports = { findAsyncMethodParams };
