"use strict";

const { normalizeString } = require("../../../infra/util");

const { buildToolInputFromSchema } = require("./exec-schema");
const { writeFileText } = require("./exec-fs");
const { extractReferenceIdFromToolResult, extractTerminalIdsFromText, extractTerminalIdsFromToolResult } = require("./exec-extract");

async function runTerminalToolSmokeTests({ byName, callIfPresent, emit, workspaceRoot, bigRel, bigAbs } = {}) {
  const map = byName instanceof Map ? byName : new Map();
  const call = typeof callIfPresent === "function" ? callIfPresent : null;
  if (!call) throw new Error("callIfPresent missing");

  // 5) 为 view-range-untruncated/search-untruncated 准备“可被截断”的大输出
  // 注意：reference_id 来自 truncation footer（通常由 launch-process 的截断输出提供），而不是 view 的 <response clipped>。
  const untruncatedNeedle = "NEEDLE_4242";
  try {
    const bigLines = [];
    for (let i = 1; i <= 6000; i++) {
      bigLines.push(`LINE ${String(i).padStart(4, "0")} :: ${"x".repeat(60)}${i === 4242 ? ` ${untruncatedNeedle}` : ""}`);
    }
    await writeFileText(bigAbs, bigLines.join("\n") + "\n");
  } catch (err) {
    emit?.(`[toolsExec] WARN failed to prepare truncated content: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6) 终端/进程：launch-process -> list -> read/write -> kill
  const isWin = typeof process !== "undefined" && process && process.platform === "win32";

  let terminalId = null;
  let maxTerminalIdBeforeInteractive = null;
  const lpDef = map.get("launch-process");
  if (lpDef) {
    const cwdOverrides = {
      cwd: workspaceRoot,
      workdir: workspaceRoot,
      working_dir: workspaceRoot,
      working_directory: workspaceRoot,
      workingDirectory: workspaceRoot,
      workingDir: workspaceRoot,
      directory: workspaceRoot,
      dir: workspaceRoot
    };
    // 先用大输出触发 truncation footer（生成 reference_id），再跑后续终端交互测试。
    // - mac/linux: cat -n
    // - windows: PowerShell Get-Content
    const bigOutCmd = isWin
      ? `powershell -NoProfile -Command "Get-Content -Path '${bigRel.replace(/'/g, "''")}'; Write-Output 'BYOK_SELFTEST'"`
      : `cat -n "${bigRel}"; echo BYOK_SELFTEST`;
    const lp1 = await call(
      "launch-process",
      buildToolInputFromSchema(lpDef, { overrides: { ...cwdOverrides, command: bigOutCmd, wait: true, max_wait_seconds: 15, maxWaitSeconds: 15 } })
    );
    const ids = extractTerminalIdsFromToolResult(lp1?.res);
    if (ids.length) terminalId = Math.max(...ids);

    // view-range-untruncated + search-untruncated：reference_id 在截断 footer 里（Reference ID: xxx）
    const referenceId = extractReferenceIdFromToolResult(lp1?.res);
    if (!referenceId) {
      emit?.("[toolsExec] WARN no reference_id detected from launch-process output (untruncated tools may fail; check enableUntruncatedContentStorage)");
    }

    const vrDef = map.get("view-range-untruncated");
    if (vrDef) {
      await call(
        "view-range-untruncated",
        buildToolInputFromSchema(vrDef, { overrides: { reference_id: referenceId, referenceId: referenceId, start_line: 1, end_line: 30, startLine: 1, endLine: 30 } })
      );
    }
    const suDef = map.get("search-untruncated");
    if (suDef) {
      const sr = await call(
        "search-untruncated",
        buildToolInputFromSchema(suDef, {
          overrides: { reference_id: referenceId, referenceId: referenceId, search_term: untruncatedNeedle, searchTerm: untruncatedNeedle, context_lines: 2, contextLines: 2 }
        })
      );
      const st = normalizeString(sr?.res?.text);
      if (st && !st.includes(untruncatedNeedle)) {
        emit?.("[toolsExec] WARN search-untruncated ok but missing expected needle (unexpected truncation or schema mismatch?)");
      }
    }
  }

  const listDef = map.get("list-processes");
  let listText = "";
  if (listDef) {
    const lr = await call("list-processes", buildToolInputFromSchema(listDef, {}));
    listText = normalizeString(lr?.res?.text);
    const idsAll = extractTerminalIdsFromText(listText);
    if (idsAll.length) maxTerminalIdBeforeInteractive = Math.max(...idsAll);
    if (terminalId == null) {
      const ids = idsAll;
      if (ids.length) terminalId = Math.max(...ids);
    }
  }

  const rpDef = map.get("read-process");
  if (rpDef && terminalId != null) {
    await call(
      "read-process",
      buildToolInputFromSchema(rpDef, { overrides: { terminal_id: terminalId, terminalId: terminalId, wait: true, max_wait_seconds: 5, maxWaitSeconds: 5 } })
    );
  }

  const rtDef = map.get("read-terminal");
  let interactiveTerminalId = null;
  const wpDef = map.get("write-process");
  const kpDef = map.get("kill-process");

  // write-process：需要一个可交互进程；这里用跨平台 shell（win: powershell, unix: sh）
  if (lpDef) {
    const shellCmd = isWin ? "powershell -NoProfile -NoLogo" : "sh";
    const lp2 = await call(
      "launch-process",
      buildToolInputFromSchema(lpDef, {
        overrides: {
          cwd: workspaceRoot,
          workdir: workspaceRoot,
          working_dir: workspaceRoot,
          working_directory: workspaceRoot,
          workingDirectory: workspaceRoot,
          workingDir: workspaceRoot,
          directory: workspaceRoot,
          dir: workspaceRoot,
          command: shellCmd,
          wait: false,
          max_wait_seconds: 1,
          maxWaitSeconds: 1
        }
      })
    );
    const ids2 = extractTerminalIdsFromToolResult(lp2?.res);
    if (ids2.length) interactiveTerminalId = Math.max(...ids2);

    // fallback：通过 list-processes 的“增量”推断新 terminal_id
    if (interactiveTerminalId == null && listDef) {
      const lr2 = await call("list-processes", buildToolInputFromSchema(listDef, {}));
      const idsFromList = extractTerminalIdsFromText(lr2?.res?.text);
      const prevMax = Number.isFinite(Number(maxTerminalIdBeforeInteractive)) ? Number(maxTerminalIdBeforeInteractive) : null;
      const candidates = prevMax == null ? idsFromList : idsFromList.filter((x) => x > prevMax);
      if (candidates.length) interactiveTerminalId = Math.max(...candidates);
      else if (idsFromList.length) interactiveTerminalId = Math.max(...idsFromList);
    }
  }

  const activeTerminalId = interactiveTerminalId != null ? interactiveTerminalId : terminalId;

  if (wpDef && activeTerminalId != null) {
    const token = "BYOK_WRITE_TEST";
    const inputText = `echo ${token}\n`;
    const writeOverrides = {
      terminal_id: activeTerminalId,
      terminalId: activeTerminalId,
      input_text: inputText,
      inputText: inputText,
      text: inputText,
      command: inputText
    };
    await call("write-process", buildToolInputFromSchema(wpDef, { overrides: writeOverrides }));
  }

  if (rpDef && activeTerminalId != null) {
    const rr = await call(
      "read-process",
      buildToolInputFromSchema(rpDef, { overrides: { terminal_id: activeTerminalId, terminalId: activeTerminalId, wait: true, max_wait_seconds: 5, maxWaitSeconds: 5 } })
    );
    if (rr?.ok) {
      const text = normalizeString(rr?.res?.text);
      if (text && !text.includes("BYOK_WRITE_TEST")) emit?.("[toolsExec] WARN read-process ok but missing expected token");
    }
  }

  if (rtDef) {
    const overrides = { wait: true, max_wait_seconds: 2, maxWaitSeconds: 2 };
    if (activeTerminalId != null) {
      overrides.terminal_id = activeTerminalId;
      overrides.terminalId = activeTerminalId;
    }
    await call("read-terminal", buildToolInputFromSchema(rtDef, { overrides }));
  }

  if (kpDef && activeTerminalId != null) {
    await call("kill-process", buildToolInputFromSchema(kpDef, { overrides: { terminal_id: activeTerminalId, terminalId: activeTerminalId } }));
  }
  if (kpDef && terminalId != null && activeTerminalId != null && terminalId !== activeTerminalId) {
    await call("kill-process", buildToolInputFromSchema(kpDef, { overrides: { terminal_id: terminalId, terminalId: terminalId } }));
  }
}

module.exports = { runTerminalToolSmokeTests };
