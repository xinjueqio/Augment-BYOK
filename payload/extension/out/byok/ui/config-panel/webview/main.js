(function () {
  "use strict";

  const ns = window.__byokCfgPanel;
  const core = ns && typeof ns === "object" ? ns.__byokCfgPanelCore : null;
  if (!ns || typeof ns.qs !== "function" || !core || typeof core.setUiState !== "function") throw new Error("BYOK panel init failed (missing core)");

  const { qs } = ns;
  const { setUiState, postToExtension } = core;

  function init() {
    try {
      const initEl = qs("#byokInit");
      const initObj = initEl ? JSON.parse(initEl.textContent || "{}") : {};
      const cfg = initObj.config || {};
      setUiState({ cfg, summary: initObj.summary || {}, status: "Ready.", clearOfficialToken: false, dirty: false }, { preserveEdits: false });
    } catch {
      setUiState({ cfg: {}, summary: {}, status: "Init failed.", clearOfficialToken: false, dirty: false }, { preserveEdits: false });
    }
    postToExtension({ type: "init" });
  }

  init();
})();
