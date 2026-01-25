"use strict";

const { normalizeString } = require("../../../infra/util");

const shared = require("../../augment-chat/shared");
const { sampleJsonFromSchema } = require("../schema-sample");

function extractExactStringRequirementFromSchema(propSchema) {
  const desc = normalizeString(propSchema?.description);
  if (!desc) return "";
  const m = desc.match(/exactly this string:\s*'([^']+)'/i) || desc.match(/exactly this string:\s*"([^"]+)"/i);
  return m ? String(m[1] || "").trim() : "";
}

function buildToolInputFromSchema(toolDef, { overrides, defaults } = {}) {
  const schema = shared.resolveToolSchema(toolDef);
  const props = schema && typeof schema === "object" && schema.properties && typeof schema.properties === "object" ? schema.properties : {};
  const required = Array.isArray(schema?.required) ? schema.required.map((x) => normalizeString(x)).filter(Boolean) : [];

  const out = {};
  const hasProp = (k) => Object.prototype.hasOwnProperty.call(props, k);
  const set = (k, v) => {
    if (!k || !hasProp(k)) return false;
    out[k] = v;
    return true;
  };

  // 1) 先填 required（否则部分工具会直接拒绝）
  for (const k of required) {
    if (!k || !hasProp(k)) continue;
    out[k] = sampleJsonFromSchema(props[k], 0);
  }

  // 2) 对 reminder 类字段，尝试从 schema.description 中解析出“必须完全一致”的字符串
  for (const k of required) {
    if (!k) continue;
    if (!/reminder/i.test(k)) continue;
    const expected = extractExactStringRequirementFromSchema(props[k]);
    if (expected) set(k, expected);
  }

  // 3) defaults（安全的“环境默认值”）
  const d = defaults && typeof defaults === "object" ? defaults : {};
  for (const [k, v] of Object.entries(d)) {
    if (hasProp(k) && out[k] == null) out[k] = v;
  }

  // 4) overrides（测试用例强制覆盖）
  const o = overrides && typeof overrides === "object" ? overrides : {};
  for (const [k, v] of Object.entries(o)) set(k, v);

  return out;
}

module.exports = { buildToolInputFromSchema };
