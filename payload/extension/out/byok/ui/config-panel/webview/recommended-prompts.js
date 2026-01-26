(function () {
  "use strict";

  const ns = (window.__byokCfgPanel = window.__byokCfgPanel || {});
  if (!ns || typeof ns.normalizeStr !== "function") return;

  const { normalizeStr } = ns;

  const RECOMMENDED_PROMPTS_V1 = Object.freeze({
    endpointSystem: Object.freeze({
      "/chat": [
        "默认使用简体中文回答（除非用户明确要求英文/日文等）。",
        "优先级：正确性 > 最小改动 > 一致性；避免无关重构。",
        "改代码时：移除死代码/旧逻辑/重复逻辑；保持现有风格与接口不变；必要时补齐测试与文档。",
        "输出：先给结论/下一步，再给必要细节；不确定时先问澄清问题。"
      ].join("\n"),
      "/chat-stream": [
        "默认使用简体中文回答（除非用户明确要求英文/日文等）。",
        "优先级：正确性 > 最小改动 > 一致性；避免无关重构。",
        "改代码时：移除死代码/旧逻辑/重复逻辑；保持现有风格与接口不变；必要时补齐测试与文档。",
        "输出：分段说明，但不要遗漏最终结论/下一步。"
      ].join("\n"),
      "/completion": "Follow existing style. Output only the completion text. Avoid explanations and markdown.",
      "/chat-input-completion": "Follow existing style. Output only the completion text. Avoid explanations and markdown.",
      "/edit": "Output only replacement code. Preserve formatting and surrounding style. No extra commentary.",
      "/instruction-stream": "Stream only replacement code. Preserve formatting and surrounding style. No extra commentary.",
      "/smart-paste-stream": "Stream only the final pasted content. Preserve formatting. No extra commentary.",
      "/next-edit-stream": "Output only replacement code for the selected range. Prefer minimal, safe edits.",
      "/next_edit_loc":
        "Return STRICT JSON only (no markdown, no comments, no trailing commas). Prefer minimal, high-signal locations backed by diagnostics/recent changes.",
      "/prompt-enhancer": "Rewrite the prompt to be clearer while preserving constraints. Keep the original language. Output only the improved prompt text.",
      "/generate-commit-message-stream": "Output one concise English commit subject (Conventional Commits if applicable). No quotes, no trailing period.",
      "/generate-conversation-title": "Output a short, specific English title (<= 8 words). No quotes. No markdown."
    })
  });

  ns.RECOMMENDED_PROMPTS_V1 = RECOMMENDED_PROMPTS_V1;

  ns.handlePromptsAction = function handlePromptsAction({ action, gatherConfigFromDom, setUiState } = {}) {
    const a = normalizeStr(action);
    if (a !== "promptsApplyRecommended") return false;
    if (typeof gatherConfigFromDom !== "function" || typeof setUiState !== "function") return false;

    const cfg = gatherConfigFromDom();
    cfg.prompts = cfg.prompts && typeof cfg.prompts === "object" && !Array.isArray(cfg.prompts) ? cfg.prompts : (cfg.prompts = {});

    cfg.prompts.endpointSystem = { ...RECOMMENDED_PROMPTS_V1.endpointSystem };
    try {
      delete cfg.prompts.activePresetId;
      delete cfg.prompts.presets;
      delete cfg.prompts.globalSystem;
    } catch {}

    setUiState({ cfg, status: "Recommended prompts applied (pending save).", dirty: true }, { preserveEdits: false });
    return true;
  };
})();
