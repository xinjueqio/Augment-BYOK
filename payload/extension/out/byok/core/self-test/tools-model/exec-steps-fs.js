"use strict";

const shared = require("../../augment-chat/shared");

const { buildToolInputFromSchema } = require("./exec-schema");
const { writeFileText, readFileText, pathExists } = require("./exec-fs");

async function runFsToolSmokeTests({ byName, callIfPresent, emit, scratchRelDir, fileRel, fileAbs } = {}) {
  const map = byName instanceof Map ? byName : new Map();
  const call = typeof callIfPresent === "function" ? callIfPresent : null;
  if (!call) throw new Error("callIfPresent missing");

  // 1) save-file：创建测试文件
  const fileContent = ["BYOK-TEST-LINE-1", "BYOK-TEST-LINE-2", "BYOK-TEST-LINE-3"].join("\n") + "\n";
  const saveDef = map.get("save-file");
  if (saveDef) {
    const saveInput = buildToolInputFromSchema(saveDef, {
      overrides: { path: fileRel, file_content: fileContent, add_last_line_newline: true }
    });
    await call("save-file", saveInput);
    if (!(await pathExists(fileAbs))) throw new Error("save-file succeeded but file missing");
  } else {
    // fallback：如果 save-file 不存在也要能继续（但按 23 工具期望通常存在）
    await writeFileText(fileAbs, fileContent);
  }

  // 2) view：文件/目录/正则（至少一次 call 即算覆盖；这里做更贴近真实使用的 3 次）
  const viewDef = map.get("view");
  if (viewDef) {
    await call("view", buildToolInputFromSchema(viewDef, { overrides: { type: "file", path: fileRel } }));
    await call("view", buildToolInputFromSchema(viewDef, { overrides: { type: "directory", path: scratchRelDir } }));
    await call(
      "view",
      buildToolInputFromSchema(viewDef, { overrides: { type: "file", path: fileRel, search_query_regex: "BYOK-TEST-LINE-2", case_sensitive: true } })
    );
  }

  // 3) str-replace-editor：替换一行
  const sreDef = map.get("str-replace-editor");
  if (sreDef) {
    const schema = shared.resolveToolSchema(sreDef);
    const props = schema && typeof schema === "object" && schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    const isNested = Object.prototype.hasOwnProperty.call(props, "str_replace_entries");
    const isFlat = Object.prototype.hasOwnProperty.call(props, "old_str_1") || Object.prototype.hasOwnProperty.call(props, "new_str_1");
    let sreInput;
    if (isNested) {
      sreInput = buildToolInputFromSchema(sreDef, {
        overrides: {
          command: "str_replace",
          path: fileRel,
          str_replace_entries: [
            {
              old_str: "BYOK-TEST-LINE-2",
              new_str: "BYOK-TEST-LINE-2-REPLACED",
              old_str_start_line_number: 2,
              old_str_end_line_number: 2
            }
          ]
        }
      });
    } else if (isFlat) {
      sreInput = buildToolInputFromSchema(sreDef, {
        overrides: {
          command: "str_replace",
          path: fileRel,
          old_str_1: "BYOK-TEST-LINE-2",
          new_str_1: "BYOK-TEST-LINE-2-REPLACED",
          old_str_start_line_number_1: 2,
          old_str_end_line_number_1: 2
        }
      });
    } else {
      // schema 变更：尽量兜底（至少确保 path/command）
      sreInput = buildToolInputFromSchema(sreDef, { overrides: { command: "str_replace", path: fileRel } });
    }
    await call("str-replace-editor", sreInput);
    const after = await readFileText(fileAbs);
    if (!after.includes("BYOK-TEST-LINE-2-REPLACED")) emit?.("[toolsExec] WARN str-replace-editor executed but file content not updated as expected");
  }

  // 4) remove-files：删除文件
  const rmDef = map.get("remove-files");
  if (rmDef) {
    await call("remove-files", buildToolInputFromSchema(rmDef, { overrides: { file_paths: [fileRel] } }));
    if (await pathExists(fileAbs)) emit?.("[toolsExec] WARN remove-files executed but file still exists");
  }
}

module.exports = { runFsToolSmokeTests };
