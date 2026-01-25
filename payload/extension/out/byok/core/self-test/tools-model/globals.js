"use strict";

const { getByokUpstreamGlobals, findDeep } = require("../../../runtime/upstream/discovery");

function isToolsModelCandidate(v) {
  return v && typeof v === "object" && typeof v.getToolDefinitions === "function" && typeof v.callTool === "function";
}

function getToolsModelFromUpstreamOrNull() {
  const { upstream } = getByokUpstreamGlobals();
  const direct = upstream?.toolsModel;
  if (isToolsModelCandidate(direct)) return direct;
  const ext = upstream?.augmentExtension;
  return (
    findDeep(ext, isToolsModelCandidate, { maxDepth: 5, maxNodes: 4000 }) ||
    findDeep(upstream, isToolsModelCandidate, { maxDepth: 4, maxNodes: 4000 })
  );
}

module.exports = { getByokUpstreamGlobals, isToolsModelCandidate, getToolsModelFromUpstreamOrNull };
