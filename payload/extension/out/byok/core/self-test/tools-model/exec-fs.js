"use strict";

const fs = require("fs");
const path = require("path");

const { normalizeString } = require("../../../infra/util");

function normalizeFsPath(p) {
  const s = normalizeString(p);
  if (!s) return "";
  return s.replace(/\\/g, "/");
}

async function ensureDir(dirPath) {
  const p = normalizeString(dirPath);
  if (!p) return false;
  await fs.promises.mkdir(p, { recursive: true });
  return true;
}

async function writeFileText(filePath, content) {
  const p = normalizeString(filePath);
  if (!p) throw new Error("filePath empty");
  await ensureDir(path.dirname(p));
  await fs.promises.writeFile(p, String(content ?? ""), "utf8");
  return true;
}

async function readFileText(filePath) {
  const p = normalizeString(filePath);
  if (!p) throw new Error("filePath empty");
  return await fs.promises.readFile(p, "utf8");
}

async function pathExists(filePath) {
  try {
    await fs.promises.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function rmPathRecursive(p) {
  const target = normalizeString(p);
  if (!target) return;
  // Node 18+ supports fs.promises.rm; VSCode extension host一般是 Node 18+，但这里做一次兼容兜底。
  try {
    if (typeof fs.promises.rm === "function") {
      await fs.promises.rm(target, { recursive: true, force: true });
      return;
    }
  } catch {}
  try {
    const st = await fs.promises.stat(target);
    if (st.isDirectory()) {
      const entries = await fs.promises.readdir(target);
      await Promise.all(entries.map((name) => rmPathRecursive(path.join(target, name))));
      await fs.promises.rmdir(target).catch(() => void 0);
    } else {
      await fs.promises.unlink(target).catch(() => void 0);
    }
  } catch {}
}

module.exports = { normalizeFsPath, ensureDir, writeFileText, readFileText, pathExists, rmPathRecursive };
