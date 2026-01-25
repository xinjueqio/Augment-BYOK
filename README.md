# Augment-BYOK

单一 VSIX：把 Augment 的 **13 个 LLM 数据面端点**按路由转到 BYOK（支持 Streaming），其它端点保持官方行为；支持运行时一键回滚（无需 Rust/外部服务）。

## 安装（推荐：Releases）

- GitHub Releases（tag：`rolling`）下载 `augment.vscode-augment.*.byok.vsix`
- VS Code → Extensions → `...` → `Install from VSIX...` → Reload Window

## 配置

- `BYOK: Open Config Panel`：填写 `official` + ≥1 个 `provider` → `Save`
- `Self Test`：可选，一键验证 models / chat / chat-stream
- 配置存 `globalState`（含 Key/Token）；字段/限制见 `docs/CONFIG.md`

常用命令：
- `BYOK: Enable` / `BYOK: Disable (Rollback)`
- `BYOK: Reload Config`
- `BYOK: Clear History Summary Cache`

## 排障（高频）

- 401/403：检查 `apiKey`/`headers`；不要把 `Bearer ` 前缀重复写入（`apiKey` 会自动加 Bearer，`headers.authorization` 则应完整填写）。
- 404/HTML：`baseUrl` 很可能少了 `/v1`（OpenAI/Anthropic 兼容端点通常要求）。
- 流式无输出：确认你的服务支持 `text/event-stream`；建议直接在面板跑 `Self Test` 定位（models / chat / chat-stream）。
- BYOK 未生效：确认已 `Save`（热更新只影响后续请求）且 `BYOK: Enable`（runtimeEnabled=true）。

## 本地构建

前置：Node.js 20+、Python 3、可访问 Marketplace  
快速检查（不依赖上游缓存）：`npm run check:fast`  
完整检查（需要缓存上游 VSIX）：`npm run upstream:analyze`（一次）→ `npm run check`  
构建：`npm run build:vsix`（产物：`dist/augment.vscode-augment.<upstreamVersion>.byok.vsix`）

## 文档

- 索引：`docs/README.md`
- 配置/路由：`docs/CONFIG.md`
- 端点范围（71/13）：`docs/ENDPOINTS.md`
- 架构/补丁面：`docs/ARCH.md`
- CI/Release：`docs/CI.md`
