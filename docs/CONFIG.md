# CONFIG

单一真相：`globalState` 里的 `augment-byok.config.v1`（配置面板手填；无 JSON Import/Export）。

## 存储 keys

- `augment-byok.config.v1`：配置（含 Key/Token；不参与 Sync）
- `augment-byok.runtimeEnabled.v1`：运行时回滚开关（唯一加入 Sync）
- `augment-byok.historySummaryCache.v1`：历史摘要缓存（不参与 Sync）

## 命令

- `BYOK: Open Config Panel`：手动填写 + `Save` 生效
- `BYOK: Reload Config`：重新加载（丢弃未保存修改）
- `BYOK: Enable` / `BYOK: Disable (Rollback)`：运行时开关（不改配置）
- `BYOK: Clear History Summary Cache`：清理后台摘要缓存

## 最小配置（面板）

- 填 `official.completionUrl` + `official.apiToken`（用于 `/get-models` 合并 + 官方上下文注入）。
- 至少配置 1 个 `providers[]`（`id/type/baseUrl/models/defaultModel`；`apiKey` 可空但需在 `headers` 提供鉴权）。
- 点击 `Save` 后发起新请求生效；需要启用时运行 `BYOK: Enable`（否则会回滚 official）。

参考结构见仓库根目录 `config.example.json`（仅示例，不会自动导入到面板）。

## 配置结构（v1，概要）

- `official`：`completionUrl` / `apiToken`（用于 `/get-models` 合并 + 官方上下文注入）
- `providers[]`：上游列表
  - `id`：provider 标识（`byok:<providerId>:...`）
  - `type`：
    <!-- BEGIN GENERATED: PROVIDER_TYPES -->
    `openai_compatible` | `openai_responses` | `anthropic` | `gemini_ai_studio`
    <!-- END GENERATED: PROVIDER_TYPES -->
  - `baseUrl`、`apiKey`（可空，若 `headers` 已含鉴权）、`headers`、`models`、`defaultModel`、`requestDefaults`
- `routing`：`rules[endpoint]`（`mode=official|byok|disabled`；provider 留空时默认使用 `providers[0]`；与内置默认规则合并：未出现的 endpoint 保持默认）
- `historySummary`：面板暴露 `enabled` + byok model 选择（保存时映射为 `providerId` + `model`）；其它字段默认/保留

## 语义/限制

- BYOK 只对 **13 个 LLM 数据面端点**提供语义实现：见 `ENDPOINTS.md`（其它端点即使配置 `byok` 也会回落 official）
- model id：`byok:<providerId>:<modelId>`（`/get-models` 会注入 model registry/feature flags）
- `/chat` / `/chat-stream` 均支持全部 `providers[].type`（见上方 `providers[].type` 列表）
- `mode=disabled`：`callApi` 返回 `{}`；`callApiStream` 返回空 stream
- 官方上下文注入（仅 `/chat`、`/chat-stream`）：`agents/codebase-retrieval`、`get-implicit-external-sources`、`search-external-sources`、`context-canvas/list`
  - 关闭：请求体 `disable_retrieval=true` 或 `disableRetrieval=true`
  - 失败：忽略（不影响 BYOK 生成）
- 工具调用：会做 tool_result 配对修复避免 400/422（实现见 `payload/extension/out/byok/core/tool-pairing/index.js`）
- Anthropic：`requestDefaults` 会自动过滤 OpenAI-only 字段（如 `presence_penalty`、`response_format`、`stream_options`），并兼容 `stop`→`stop_sequences`、`topP/topK`→`top_p/top_k`
- Anthropic：遇到 400/422 会自动做一次“最小化 requestDefaults”重试（保留 `max_tokens`），降低偶发 INVALID_ARGUMENT
- OpenAI Responses：`requestDefaults` 兼容 `max_tokens/maxTokens/maxOutputTokens` 别名（会映射为 `max_output_tokens`）；遇到 400/422 会自动用 minimal-defaults 重试（仅保留 `max_output_tokens`）
- Gemini：`requestDefaults` 兼容 `max_tokens/maxTokens/max_output_tokens/maxOutputTokens` 别名（会映射为 `generationConfig.maxOutputTokens`）；遇到 400/422 会按 `no-defaults/no-images/no-tools` 兜底重试

兼容：
- 旧字段 `telemetry.disabledEndpoints` 仍会被读取，并映射为 `routing.rules[*].mode=disabled`；面板不再展示该字段。
