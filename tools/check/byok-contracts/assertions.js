"use strict";

const fs = require("fs");
const path = require("path");

const { assert } = require("./util");

function assertFileExists(root, rel) {
  const p = path.join(root, rel);
  assert(fs.existsSync(p), `missing file: ${rel}`);
  return p;
}

function assertContains(src, needle, label) {
  assert(src.includes(needle), `missing needle (${label || "unknown"}): ${JSON.stringify(needle)}`);
}

function assertHasCommand(pkg, cmd) {
  const commands = Array.isArray(pkg?.contributes?.commands) ? pkg.contributes.commands : [];
  const okCmd = commands.some((c) => c && typeof c.command === "string" && c.command === cmd);
  assert(okCmd, `package.json missing command: ${cmd}`);
}

function assertModelRegistryFlags(flags) {
  assert(flags && typeof flags === "object" && !Array.isArray(flags), "feature_flags not object");
  assert(flags.enableModelRegistry === true || flags.enable_model_registry === true, "enableModelRegistry missing/false");
  assert(typeof flags.modelRegistry === "string" || typeof flags.model_registry === "string", "modelRegistry missing");
  assert(typeof flags.modelInfoRegistry === "string" || typeof flags.model_info_registry === "string", "modelInfoRegistry missing");
  assert(typeof flags.agentChatModel === "string" || typeof flags.agent_chat_model === "string", "agentChatModel missing");
}

module.exports = { assertFileExists, assertContains, assertHasCommand, assertModelRegistryFlags };

