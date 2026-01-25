# docs/

文档以“单一真相 + 交叉引用”为原则：每条信息尽量只在一个地方定义。

- `../README.md`：安装/使用（Releases/面板/回滚/构建）
- `CONFIG.md`：配置字段/路由语义/限制
- `ENDPOINTS.md`：端点范围（71 / 13）
- `ARCH.md`：构建/补丁面/模块边界
- `CI.md`：CI/rolling release/审计产物
- `ROADMAP.md`：路线图
- `TESTPLAN.md`：回归 checklist
- `CODESTYLE.md`：硬规则

推荐阅读顺序：
- 使用：`../README.md` → `CONFIG.md`
- 开发：`ARCH.md` → `CONFIG.md` → `ENDPOINTS.md`
- 审查：`CI.md` → `ARCH.md` → `ENDPOINTS.md`

本地常用命令：
- `npm run check:fast`：快速静态检查 + 单测（不依赖上游缓存）
- `npm run check`：完整检查（含合约；需先有 `.cache/upstream/*.vsix`，可运行 `npm run upstream:analyze`）
- `npm run check:provider-dispatch`：强制 provider.type 分发收敛（避免 runtime/self-test/historySummary 漂移）
- `npm run gen`：一键同步所有生成区块（ENDPOINTS/provider types 等）
- `npm run gen:llm-endpoints`：同步 13 个 LLM 端点单一真相到 UI/文档（通常只在修改 spec 时需要）
- `npm run gen:provider-types`：同步 provider.type 枚举单一真相到 UI/文档（通常只在修改 types 时需要）
