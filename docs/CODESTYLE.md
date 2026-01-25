# CODESTYLE

硬规则（为避免再次结构失控）：

- 单文件 ≤ 400 行（强制：`npm run check:codestyle`）；单模块单职责
- 代码文件命名（`.js`）：全小写；单词用 `-`；多维度/变体用 `.` 分段（每段仍用 kebab-case）；避免 camelCase / `_` / 空格（强制：`npm run check:codestyle`）
- 目录命名：同样使用 kebab-case；避免 camelCase / `_` / 空格（尤其是 `payload/extension/out/byok/*`）
- 模块入口形态：禁止同目录出现 `foo.js` 与 `foo/`（require 解析/维护容易混乱）；需要拆分子模块时，用 `foo/index.js` 作为入口（强制：`npm run check:codestyle`）
- 禁止纯转发模块：避免出现仅 `module.exports = require(...)` 的空转文件（强制：`npm run check:codestyle`）
- CLI 入口：优先用 `main.js` 自执行（`if (require.main === module) main()`）；避免新增仅包装 `require(...).main()` 的 `*-cli.js` 转发文件
- 单函数 ≤ 80 行（建议：尽量拆分；目前不做自动强制）
- patch 薄、域层厚：注入只交控制权给 shim；逻辑放在 `payload/extension/out/byok/*`
- 失败可控：异常必须可回落 official（`return undefined` / empty stream）
- 运行时只用 `fetch` + 基础工具；避免 `child_process` 等高风险面
- 日志必须脱敏（永不输出 key/token 全文）
- 共享常量只放一处：优先集中到 `payload/extension/out/byok/infra/constants.js`（避免 timeout/limit 漂移）
- provider 分发单一真相：`provider.type` 的分支只允许出现在少数模块（`core/provider-text.js`、`core/provider-augment-chat.js`、`providers/models.js`、`core/augment-history-summary/provider-dispatch.js`、`core/self-test/*`；强制：`npm run check:provider-dispatch`）

备注：运行时代码为 CommonJS JS；类型边界用 `normalize/validate` 固定形状。

## 命名约定（强烈建议）

这些不是硬闸门，但能显著降低“同类逻辑重复实现”的概率：

- 目录入口：`index.js` 必须承担明确职责（聚合导出/拼装/对外 API）；避免出现“仅 re-export”式的空转入口
- 导出面收敛：`module.exports` 视为模块对外 API；只导出确实被外部使用的符号，内部 helper 保持私有（降低误用/耦合与回归面）
- 工具文件：`*-util.js` 表示无副作用的纯工具（可单测）；避免把 I/O 与纯逻辑混在 util
- Provider 目录：优先 `request.js` 放 HTTP 请求/重试；`json-util.js` 放 JSON→Augment chunks/文本；`index.js` 作为对外入口（OpenAI 例外：按 API 变体拆分为 `openai/chat-completions-*.js`；OpenAI-Responses 目录与其它 provider 一致：`openai-responses/{request,json-util,index}.js`）
- tool_use/token_usage/final chunk：统一复用 `payload/extension/out/byok/providers/chat-chunks-util.js`（避免每个 provider 手写 stop_reason / nodeId 规则）
- 生成产物：`docs/ENDPOINTS.md` 与 UI 的 endpoints 展示块由 `npm run gen:llm-endpoints` 同步；不要手改生成区块（CI 会校验）
- 生成产物：`docs/CONFIG.md` 的 provider types 列表与 UI 的 provider type 下拉/校验由 `npm run gen:provider-types` 同步；不要手改生成区块（CI 会校验）

## 可执行检查

- 文件行数上限 + `.js` 文件命名通过 `npm run check:codestyle` 强制（CI 同步执行）。
- 目录命名（kebab-case）通过 `npm run check:codestyle` 强制（CI 同步执行）。
- `foo.js` + `foo/` 同名冲突通过 `npm run check:codestyle` 强制（CI 同步执行）。
- 纯转发模块（`module.exports = require(...)`）通过 `npm run check:codestyle` 强制（CI 同步执行）。
- provider.type 分发收敛通过 `npm run check:provider-dispatch` 强制（CI 同步执行）。
- 目前无单文件行数豁免（全部遵守 ≤ 400 行）。
