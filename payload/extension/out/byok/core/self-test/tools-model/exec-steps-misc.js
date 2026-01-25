"use strict";

const shared = require("../../augment-chat/shared");
const { normalizeString } = require("../../../infra/util");

const { buildToolInputFromSchema } = require("./exec-schema");
const { writeFileText } = require("./exec-fs");
const { findTaskUuidInPlan } = require("./exec-extract");

async function runMiscToolSmokeTests({ byName, callIfPresent, emit, toolsModel, conversationId, diagRel, diagAbs } = {}) {
  const map = byName instanceof Map ? byName : new Map();
  const call = typeof callIfPresent === "function" ? callIfPresent : null;
  if (!call) throw new Error("callIfPresent missing");

  // 7) diagnostics
  const diagDef = map.get("diagnostics");
  if (diagDef) {
    await writeFileText(diagAbs, "const x = ;\n");
    await call("diagnostics", buildToolInputFromSchema(diagDef, { overrides: { paths: [diagRel] } }));
  }

  // 8) codebase-retrieval
  const cbrDef = map.get("codebase-retrieval");
  if (cbrDef) {
    await call("codebase-retrieval", buildToolInputFromSchema(cbrDef, { overrides: { information_request: "BYOK-test 目录在本仓库/环境中的用途是什么？" } }));
  }

  // 9) web-search / web-fetch / open-browser
  const wsDef = map.get("web-search");
  if (wsDef)
    await call(
      "web-search",
      buildToolInputFromSchema(wsDef, { overrides: { query: "example.com robots.txt", search_term: "example.com robots.txt", q: "example.com robots.txt" } })
    );
  const wfDef = map.get("web-fetch");
  if (wfDef) await call("web-fetch", buildToolInputFromSchema(wfDef, { overrides: { url: "https://example.com" } }));
  const obDef = map.get("open-browser");
  if (obDef) await call("open-browser", buildToolInputFromSchema(obDef, { overrides: { url: "https://example.com" } }));

  // 10) render-mermaid
  const mmDef = map.get("render-mermaid");
  if (mmDef) {
    await call(
      "render-mermaid",
      buildToolInputFromSchema(mmDef, {
        overrides: {
          title: "BYOK Self Test",
          diagram_definition: "flowchart LR\n  A[Self Test] --> B{ToolsModel}\n  B --> C[callTool]\n  C --> D[Result]"
        }
      })
    );
  }

  // 11) tasklist：view/add/update/reorganize
  const vtDef = map.get("view_tasklist");
  const atDef = map.get("add_tasks");
  const utDef = map.get("update_tasks");
  const rt2Def = map.get("reorganize_tasklist");

  // tasklist 工具要求 conversationId 已初始化 root task（否则会报 `No root task found.`）。
  // upstream ToolsModel 暴露了 taskManager；如可用，优先为 self-test 的 conversationId 建立 root task。
  try {
    const taskManager = toolsModel?.taskManager;
    if (taskManager && typeof taskManager.getRootTaskUuid === "function") {
      const root = taskManager.getRootTaskUuid(conversationId);
      if (!root && typeof taskManager.createNewTaskList === "function") {
        await taskManager.createNewTaskList(conversationId);
      }
    }
  } catch (err) {
    emit?.(`[toolsExec] WARN failed to initialize tasklist root: ${err instanceof Error ? err.message : String(err)}`);
  }

  let taskMarkdown = "";
  if (vtDef) {
    const r = await call("view_tasklist", buildToolInputFromSchema(vtDef, {}));
    taskMarkdown = normalizeString(r?.res?.text);
  }
  let newTaskUuid = "";
  if (atDef) {
    const addRes = await call(
      "add_tasks",
      buildToolInputFromSchema(atDef, {
        overrides: { tasks: [{ name: "BYOK Self Test Task", description: "Created by self test", state: "NOT_STARTED" }] }
      })
    );
    const plan = addRes?.res?.plan;
    newTaskUuid = findTaskUuidInPlan(plan, ({ name }) => name.includes("BYOK Self Test Task"));

    // 刷新一次 tasklist，便于从 markdown 中提取 uuid（plan 结构在不同版本可能不返回/不一致）
    if (vtDef) {
      const r2 = await call("view_tasklist", buildToolInputFromSchema(vtDef, {}));
      const md2 = normalizeString(r2?.res?.text);
      if (md2) taskMarkdown = md2;
      if (!newTaskUuid && md2) {
        const lines = md2.split(/\r?\n/);
        const line = lines.find((l) => l.includes("BYOK Self Test Task")) || "";
        const m = line.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (m && m[1]) newTaskUuid = String(m[1]);
      }
    }
  }
  if (utDef && newTaskUuid) {
    await call("update_tasks", buildToolInputFromSchema(utDef, { overrides: { tasks: [{ task_id: newTaskUuid, state: "IN_PROGRESS" }] } }));
    await call("update_tasks", buildToolInputFromSchema(utDef, { overrides: { tasks: [{ task_id: newTaskUuid, state: "COMPLETE" }] } }));
  }
  if (rt2Def && taskMarkdown) {
    // 最小“重排”：把 BYOK Self Test Task 移到 root task 的第一个子任务位置（避免插到 header 前导致 “level 1 has no parent”）
    const normalizeMarkdownForReorg = (md) => {
      const raw = normalizeString(md);
      if (!raw) return "";

      const lines = raw.split(/\r?\n/);
      const tasks = [];

      const parseTaskLine = (line) => {
        const s = typeof line === "string" ? line : "";
        const m = s.match(/^(\s*)(-*)\s*(\[[ x\/-]\]\s*UUID:.*)$/);
        if (!m) return null;
        const dashes = m[2] || "";
        const body = (m[3] || "").trimEnd();
        if (!body) return null;
        return { dashCount: dashes.length, body };
      };

      for (const l of lines) {
        const t = parseTaskLine(l);
        if (t) tasks.push(t);
      }
      if (!tasks.length) return raw;

      // view_tasklist 输出可能包含 header/空行；reorganize_tasklist 的 parser 对“根任务必须是 level=0”非常敏感。
      // 这里把 markdown 归一化为“仅 task 行”，并保证第一行是 root(level 0)。
      const pickRootIdx = () => {
        const preferred = tasks.findIndex(
          (t) => t.body.includes("NAME:Current Task List") || t.body.includes("Root task for conversation") || t.body.includes("Root task")
        );
        if (preferred >= 0) return preferred;
        let best = 0;
        let bestDash = Number.POSITIVE_INFINITY;
        for (let i = 0; i < tasks.length; i++) {
          const d = Number(tasks[i].dashCount) || 0;
          if (d < bestDash) {
            bestDash = d;
            best = i;
          }
        }
        return best;
      };

      const rootIdx = pickRootIdx();
      const baseDash = Math.max(0, Math.floor(Number(tasks[rootIdx]?.dashCount) || 0));

      const normalized = tasks.map((t) => ({
        dashCount: Math.max(0, Math.floor(Number(t.dashCount) || 0) - baseDash),
        body: t.body
      }));

      // 确保 root 是第一行，且 level=0
      const [rootLine] = normalized.splice(rootIdx, 1);
      normalized.unshift({ ...rootLine, dashCount: 0 });

      // 保证：除 root 外不允许出现 level=0；同时避免出现 level 跳跃导致 “missing parent”
      for (let i = 1; i < normalized.length; i++) {
        let d = Math.floor(Number(normalized[i].dashCount) || 0);
        if (d <= 0) d = 1;
        const prev = Math.floor(Number(normalized[i - 1].dashCount) || 0);
        if (d > prev + 1) d = prev + 1;
        normalized[i].dashCount = d;
      }

      // 最小重排：把 BYOK Self Test Task 移到 root 的第一个子任务位置
      const byokIdx = normalized.findIndex((t) => t.body.includes("BYOK Self Test Task"));
      if (byokIdx > 1) {
        const [line] = normalized.splice(byokIdx, 1);
        normalized.splice(1, 0, { ...line, dashCount: 1 });
      } else if (byokIdx === 1) {
        normalized[1].dashCount = 1;
      }

      return normalized.map((t) => `${"-".repeat(Math.max(0, t.dashCount))}${t.body}`).join("\n");
    };

    const markdownToSubmit = normalizeMarkdownForReorg(taskMarkdown) || taskMarkdown;
    await call("reorganize_tasklist", buildToolInputFromSchema(rt2Def, { overrides: { markdown: markdownToSubmit } }));
  }

  // 12) remember
  const remDef = map.get("remember");
  if (remDef) {
    const schema = shared.resolveToolSchema(remDef);
    const props = schema && typeof schema === "object" && schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    // remember schema 在不同版本可能是 {text} 或 {memory} 等；这里尽量兼容
    const overrides = {};
    if (Object.prototype.hasOwnProperty.call(props, "text")) overrides.text = "BYOK-test 是工具全量测试目录";
    if (Object.prototype.hasOwnProperty.call(props, "memory")) overrides.memory = "BYOK-test 是工具全量测试目录";
    if (Object.prototype.hasOwnProperty.call(props, "content")) overrides.content = "BYOK-test 是工具全量测试目录";
    if (Object.keys(overrides).length === 0) overrides.text = "BYOK-test 是工具全量测试目录";
    await call("remember", buildToolInputFromSchema(remDef, { overrides }));
  }
}

module.exports = { runMiscToolSmokeTests };
