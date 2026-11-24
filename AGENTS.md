# 小树荫前端工程规则

本仓库为 `pyxm1618/xiaoshuyin-frontend`。执行仓库写命令前确认工作目录和 origin。后端主仓 `pyxm1618/xiaoshuyin` 只允许通过 GitHub 读取正式来源；禁止后端工作区、分支、PR、规则、CI、部署及生产数据写入。

## Authority

必读 `Docs/总产品需求.md`、`Docs/总体技术架构.md`、`Docs/V1产品需求.md`、`Docs/V1技术设计.md` 及 `Docs/frontend/README.md` 所列冻结 Step 1–3。再读 `Docs/frontend/engineering/`、本宪法和适用冻结 Spec。产品、技术、领域、API、批准体验由后端主仓拥有。前端拥有工程设计、开发验收、实现和测试治理。Spec 是可追溯实现合同。

上游变更走独立同步 PR，必须绑定真实 Source Commit、blob、内容 hash 和影响；Step 4 须先在上游批准冻结。业务开发禁止顺手改 Authority 和治理。解析依赖只用真实生成合同；若 Zod / Fastify / OpenAPI 未承载某能力，登记 Contract Gap。客户端禁止实现领域状态机、Scene Routing、业务资格、安全、授权、专业判断、伪造 Consent、事件或 API。

## 交付与 STOP

遵循 [四 AI 流程](Docs/frontend/engineering/V1前端开发与验收规范.md)。Plan AI 1 Specify / Clarify / 冻结，Plan AI 2 Plan / Checklist / Tasks / Analyze / Audit 1，Developer AI Implement / Test / Converge，独立 Audit 2 对抗性只读审计当前 Exact Head。独立审计由不同 AI 完成，CI 和 GitHub human approval 均不能代替。只有 Owner 在审计与门禁通过后决定合并。

按 FE-Slice 的范围、非目标、明确依赖、Allowed / Forbidden Paths 和真实验收执行。不扩大任务、绕过保护、降低断言、套用历史 PASS 或生成虚假结果。不要复制真实家庭数据或凭证；避免敏感日志，测试用合成数据和隔离环境。按实际范围执行工程、合同、体验、视觉、真机验收。证据随 head 变化需要重新复核。遇到未知仓库、上游冲突、缺失真实依赖、越权或无法验证时停止并报告。

Bootstrap 仅工程与治理，下一阶段为独立 FE-B4。Bootstrap 执行者不得自行审计或合并候选 PR。
