"use strict";

const { normalizeEndpoint, normalizeString } = require("../infra/util");

function asObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function resolveExtraSystemPrompt(cfg, endpoint) {
  const ep = normalizeEndpoint(endpoint);
  const endpointSystem = asObject(cfg?.prompts?.endpointSystem);
  const perEndpoint =
    endpointSystem && ep && Object.prototype.hasOwnProperty.call(endpointSystem, ep) ? normalizeString(endpointSystem[ep]) : "";

  return perEndpoint;
}

module.exports = { resolveExtraSystemPrompt };
