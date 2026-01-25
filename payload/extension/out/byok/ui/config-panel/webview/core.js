(function () {
  "use strict";

  const vscode = acquireVsCodeApi();
  const ns = window.__byokCfgPanel;
  if (!ns || typeof ns.qs !== "function" || typeof ns.renderApp !== "function" || typeof ns.parseByokModelId !== "function") {
    throw new Error("BYOK panel init failed (missing util/render)");
  }

  const { qs, normalizeStr, uniq, renderApp, debugLog, withTiming, parseByokModelId } = ns;
  const dom = ns.__byokCfgPanelDom;
  if (
    !dom ||
    typeof dom.applyProvidersEditsFromDom !== "function" ||
    typeof dom.applyRulesEditsFromDom !== "function" ||
    typeof dom.gatherSelfTestProviderKeysFromDom !== "function"
  ) {
    throw new Error("BYOK panel init failed (missing dom helpers)");
  }

  function summarizeMessageForLog(msg) {
    const t = msg && typeof msg === "object" ? normalizeStr(msg.type) : "";
    const idxRaw = msg && typeof msg === "object" && "idx" in msg ? Number(msg.idx) : NaN;
    const requestId = msg && typeof msg === "object" ? normalizeStr(msg.requestId) : "";
    const out = { type: t || "(unknown)" };
    if (Number.isFinite(idxRaw)) out.idx = idxRaw;
    if (requestId) out.requestId = requestId;
    return out;
  }

  function postToExtension(msg) {
    const summary = summarizeMessageForLog(msg);
    debugLog("postMessage", summary);
    try {
      vscode.postMessage(msg);
    } catch (err) {
      debugLog("postMessage FAIL", { ...summary, err: err instanceof Error ? err.message : String(err) });
    }
  }

  function getPersistedState() {
    try {
      return vscode && typeof vscode.getState === "function" ? vscode.getState() : null;
    } catch {
      return null;
    }
  }

  function setPersistedState(patch) {
    try {
      if (!vscode || typeof vscode.setState !== "function") return;
      const prev = getPersistedState();
      const next = { ...(prev && typeof prev === "object" ? prev : {}), ...(patch && typeof patch === "object" ? patch : {}) };
      vscode.setState(next);
    } catch {}
  }

  const persisted = getPersistedState();
  const persistedSideCollapsed = persisted && typeof persisted === "object" ? Boolean(persisted.sideCollapsed) : false;
  const persistedEndpointSearch =
    persisted && typeof persisted === "object" ? normalizeStr(persisted.endpointSearch) || normalizeStr(persisted.routingAddSearch) : "";
  const persistedProviderExpanded =
    persisted && typeof persisted === "object" && persisted.providerExpanded && typeof persisted.providerExpanded === "object" && !Array.isArray(persisted.providerExpanded)
      ? persisted.providerExpanded
      : {};
  const persistedSelfTestProviderKeys =
    persisted && typeof persisted === "object" && Array.isArray(persisted.selfTestProviderKeys)
      ? uniq(persisted.selfTestProviderKeys.map((k) => normalizeStr(k)).filter(Boolean))
      : [];

  let uiState = {
    cfg: {},
    summary: {},
    status: "Ready.",
    clearOfficialToken: false,
    officialTest: { running: false, ok: null, text: "" },
    providerExpanded: persistedProviderExpanded,
    modal: null,
    dirty: false,
    selfTest: { running: false, logs: [], report: null },
    selfTestProviderKeys: persistedSelfTestProviderKeys,
    sideCollapsed: persistedSideCollapsed,
    endpointSearch: persistedEndpointSearch
  };

  function updateDirtyBadge() {
    const el = qs("#dirtyBadge");
    if (!el) return;
    el.textContent = uiState.dirty ? "pending" : "saved";
    try {
      el.classList.toggle("status-badge--warning", uiState.dirty);
      el.classList.toggle("status-badge--success", !uiState.dirty);
    } catch {}
  }

  function updateStatusText(text) {
    const el = qs("#status");
    if (!el) return;
    el.textContent = String(text ?? "");
  }

  function markDirty(statusText) {
    if (!uiState.dirty) uiState.dirty = true;
    if (statusText) uiState.status = String(statusText);
    updateDirtyBadge();
    if (statusText) updateStatusText(statusText);
  }

  function applyEndpointFilter() {
    return withTiming(
      "applyEndpointFilter",
      () => {
        const inputEl = qs("#endpointSearch");
        const raw = inputEl ? normalizeStr(inputEl.value) : normalizeStr(uiState.endpointSearch);
        const q = raw.toLowerCase();

        const rows = Array.from(document.querySelectorAll("[data-endpoint-row]"));
        let visible = 0;
        for (const row of rows) {
          const ep = normalizeStr(row.getAttribute("data-endpoint-row"));
          const desc = normalizeStr(row.getAttribute("data-endpoint-desc"));
          const hay = `${ep} ${desc}`.toLowerCase();
          const match = !q || hay.includes(q);
          row.hidden = !match;
          if (match) visible += 1;
        }

        const groups = Array.from(document.querySelectorAll("[data-endpoint-group]"));
        for (const g of groups) {
          const items = Array.from(g.querySelectorAll("[data-endpoint-row]"));
          const totalInGroup = items.length;
          const visibleInGroup = items.reduce((n, el) => (el && !el.hidden ? n + 1 : n), 0);
          const anyVisible = visibleInGroup > 0;
          g.hidden = !anyVisible;
          if (q && anyVisible && typeof g.open === "boolean") g.open = true;

          const badge = g.querySelector ? g.querySelector("[data-endpoint-group-count-badge]") : null;
          if (badge) badge.textContent = q ? `显示 ${visibleInGroup} / ${totalInGroup}` : `${totalInGroup} total`;
        }

        const countEl = qs("#endpointFilterCount");
        if (countEl) countEl.textContent = rows.length ? `显示 ${visible} / ${rows.length}` : "";
      },
      { thresholdMs: 16 }
    );
  }

  function setEndpointSearch(next) {
    uiState.endpointSearch = normalizeStr(next);
    setPersistedState({ endpointSearch: uiState.endpointSearch });
    applyEndpointFilter();
  }

  function render() {
    return withTiming(
      "render",
      () => {
        const app = qs("#app");
        const prevMain = app?.querySelector ? app.querySelector(".main") : null;
        const prevSide = app?.querySelector ? app.querySelector(".side") : null;
        const mainScrollTop = prevMain ? prevMain.scrollTop : 0;
        const sideScrollTop = prevSide ? prevSide.scrollTop : 0;

        if (app) app.innerHTML = renderApp(uiState);

        const nextMain = app?.querySelector ? app.querySelector(".main") : null;
        const nextSide = app?.querySelector ? app.querySelector(".side") : null;
        if (nextMain) nextMain.scrollTop = mainScrollTop;
        if (nextSide) nextSide.scrollTop = sideScrollTop;

        applyEndpointFilter();
      },
      { thresholdMs: 32 }
    );
  }

  function gatherConfigFromDom() {
    return withTiming(
      "gatherConfigFromDom",
      () => {
        const base = uiState.cfg && typeof uiState.cfg === "object" ? uiState.cfg : {};
        const cfg = JSON.parse(JSON.stringify(base));

        cfg.historySummary = cfg.historySummary && typeof cfg.historySummary === "object" ? cfg.historySummary : {};
        cfg.historySummary.enabled = Boolean(qs("#historySummaryEnabled")?.checked);
        cfg.historySummary.providerId = "";
        cfg.historySummary.model = "";
        const hsByokModel = normalizeStr(qs("#historySummaryByokModel")?.value);
        const parsedHsModel = parseByokModelId(hsByokModel);
        if (parsedHsModel) {
          cfg.historySummary.providerId = parsedHsModel.providerId;
          cfg.historySummary.model = parsedHsModel.modelId;
        }

        cfg.routing = cfg.routing && typeof cfg.routing === "object" ? cfg.routing : {};

        cfg.official = cfg.official && typeof cfg.official === "object" ? cfg.official : {};
        cfg.official.completionUrl = normalizeStr(qs("#officialCompletionUrl")?.value);

        const officialTokenInput = normalizeStr(qs("#officialApiToken")?.value);
        if (officialTokenInput) cfg.official.apiToken = officialTokenInput;
        if (uiState.clearOfficialToken) cfg.official.apiToken = "";

        dom.applyProvidersEditsFromDom(cfg);
        dom.applyRulesEditsFromDom(cfg);

        cfg.routing = cfg.routing && typeof cfg.routing === "object" ? cfg.routing : {};
        cfg.routing.rules = cfg.routing.rules && typeof cfg.routing.rules === "object" ? cfg.routing.rules : {};
        for (const ep of Object.keys(cfg.routing.rules)) {
          const r = cfg.routing.rules[ep] && typeof cfg.routing.rules[ep] === "object" ? cfg.routing.rules[ep] : null;
          const mode = normalizeStr(r?.mode);
          if (!r || !mode) {
            delete cfg.routing.rules[ep];
            continue;
          }
          if (mode !== "byok") {
            r.providerId = "";
            r.model = "";
          }
        }

        return cfg;
      },
      { thresholdMs: 16 }
    );
  }

  function setUiState(patch, { preserveEdits = true } = {}) {
    if (preserveEdits) {
      try {
        if (qs("#officialCompletionUrl")) uiState.cfg = gatherConfigFromDom();
      } catch {}
    }
    uiState = { ...uiState, ...(patch || {}) };
    if (patch && typeof patch === "object" && "sideCollapsed" in patch) setPersistedState({ sideCollapsed: Boolean(uiState.sideCollapsed) });
    render();
  }

  ns.__byokCfgPanelCore = {
    vscode,
    getUiState: () => uiState,
    setUiState,
    markDirty,
    setEndpointSearch,
    applyEndpointFilter,
    gatherConfigFromDom,
    gatherSelfTestProviderKeysFromDom: dom.gatherSelfTestProviderKeysFromDom,
    postToExtension,
    summarizeMessageForLog,
    getPersistedState,
    setPersistedState,
    parseByokModelId
  };
})();
