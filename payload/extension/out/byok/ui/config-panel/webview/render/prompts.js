(function () {
  "use strict";

  const ns = (window.__byokCfgPanel = window.__byokCfgPanel || {});
  const { normalizeStr, escapeHtml } = ns;

  function getEndpointCatalogV1() {
    return typeof ns.getEndpointCatalogV1 === "function" ? ns.getEndpointCatalogV1() : { meanings: {}, llmEndpoints: [] };
  }

  function asObject(v) {
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  }

  ns.renderPromptsPanel = function renderPromptsPanel({ cfg } = {}) {
    const c = cfg && typeof cfg === "object" ? cfg : {};
    const prompts = asObject(c.prompts) || {};
    const endpointSystem = asObject(prompts.endpointSystem) || {};
    const endpointCount = Object.values(endpointSystem).filter((v) => Boolean(normalizeStr(v))).length;

    const { meanings, llmEndpoints } = getEndpointCatalogV1();
    const endpoints = (Array.isArray(llmEndpoints) ? llmEndpoints : []).filter((ep) => normalizeStr(ep) && normalizeStr(ep) !== "/get-models");
    const configured = endpointCount > 0;
    const badge = configured
      ? `<span class="status-badge status-badge--success">configured</span>`
      : `<span class="status-badge status-badge--warning">default</span>`;

    const overridesOpenAttr = configured ? " open" : "";
    const overridesHtml = endpoints.length
      ? `
          <details class="endpoint-group"${overridesOpenAttr}>
            <summary class="endpoint-group-summary">
              <span>Endpoint Overrides（${escapeHtml(String(endpoints.length))}）</span>
              <span class="row" style="gap:6px;">
                <span class="badge">${escapeHtml(String(endpointCount))} configured</span>
              </span>
            </summary>
            <div class="endpoint-group-body">
              <div class="text-muted text-xs">对单个 endpoint 追加 system prompt（留空=不追加）。</div>
              <div class="text-muted text-xs">注：<span class="text-mono">/get-models</span> 不会使用 prompt（它只是模型列表）。</div>
              <div style="height:10px;"></div>
              <div class="form-grid">
                ${endpoints
                  .map((ep) => {
                    const desc = typeof meanings?.[ep] === "string" ? meanings[ep] : "";
                    const v = normalizeStr(endpointSystem?.[ep]);
                    return `
                      <div class="form-group">
                        <label class="form-label">
                          <span class="text-mono">${escapeHtml(ep)}</span>
                        </label>
                        <textarea class="mono" rows="3" data-prompt-ep="${escapeHtml(ep)}" data-prompt-key="system" placeholder="(optional)">${escapeHtml(v)}</textarea>
                        ${desc ? `<div class="text-muted text-xs">${escapeHtml(desc)}</div>` : ``}
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </details>
        `
      : `<div class="text-muted text-xs">(no LLM endpoints found)</div>`;

    return `
	      <section class="settings-panel">
	        <header class="settings-panel__header">
	          <div class="flex-row flex-wrap">
	            <span>Prompts</span>
	            ${badge}
	            ${endpointCount ? `<span class="status-badge">${escapeHtml(String(endpointCount))} overrides</span>` : ""}
	          </div>
	        </header>
	        <div class="settings-panel__body">
	          <div class="text-muted text-xs">这些提示词会被追加到 BYOK 上游模型的 system prompt（仅影响 BYOK，不影响 official）。</div>
	          <div class="text-muted text-xs">全局规则/偏好请使用 Augment 自带的 User Guidelines / Workspace Guidelines / Rules；这里仅提供按 endpoint 的追加。</div>
	          <div style="height:10px;"></div>
	          <div class="form-grid">
              <div class="form-group form-grid--full">
                <div class="flex-row flex-wrap" style="gap:6px;align-items:center;">
                  <button class="btn btn--small" data-action="promptsApplyRecommended" title="用推荐模板覆盖当前 Prompts（建议先导出备份）">一键填充（推荐）</button>
                  <span class="text-muted text-xs">覆盖当前 endpoint overrides；刷新可撤销未保存修改。</span>
                </div>
              </div>
	            <div class="form-group form-grid--full">${overridesHtml}</div>
	          </div>
	        </div>
	      </section>
	    `;
  };
})();
