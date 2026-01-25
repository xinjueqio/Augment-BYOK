# ROADMAP

原则：先安全/稳定（不破坏官方）→ 再可维护（单一真相/少重复）→ 再体验（可选）。

已落地（核心里程碑）：
- 单 VSIX、进程内 shim；只接管 13 个 LLM 数据面端点；一键回滚
- fail-fast：patch guard + contracts（上游升级时构建直接报错）
- 单一真相：13 端点 spec 生成同步到 UI/文档（CI 校验）
- hardening：日志脱敏/配置反原型污染/Webview 最小权限 + node:test

待优化（按收益排序）：
- 去重复：进一步收敛 upstream discovery / util 逻辑
- 质量闸门：补更多纯函数单测 + 低成本“未引用/仅导出未使用”清理
- 体验（可选）：面板就地校验、故障速查更精简
