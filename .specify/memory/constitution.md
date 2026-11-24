# 小树荫前端开发宪法

版本 1.0.0 候选，等待 FE-B4 独立审计。

1. **Authority First**。产品、架构和冻结体验来自后端主仓的正式版本。在本仓显式绑定、原样导入并验证来源。
2. **One Source of Truth**。服务端拥有领域事实、Case、Scene、流程资格、专业判断、安全、合规与授权；前端投影授权事实。API 类型从官方合同生成。
3. **Spec-Driven Development**。先冻结可追溯需求，再计划、清单、任务和分析。审计一准入后实现，独立审计二审核当前精确候选。
4. **Slice-Bounded Delivery**。独立 FE 编号、明确依赖、允许路径、非目标、适用验收和 STOP 条件约束每次交付。
5. **Traceability**。需求连到 Authority、任务连到需求与实测，所有实现路径归已授权所有者。变更绑定候选内容和当前验证。
6. **Evidence Before Completion**。须执行适用测试并留证。失败、未知或测试条件不足应明确标记。自动 CI 与独立审计均须真实。
7. **Privacy / Safety / Compliance**。遵守主体和受众边界、最少权限和授权撤回；关闭不真实或未获批准的路径；仅使用合成测试数据。
8. **Experience Integrity**。承接冻结体验、Recovery、Safety Priority 与 Rights Neutrality；视觉待已批准的设计，客户端不创造业务真相。
9. **Explicit Change Control**。产品或技术冲突先停止并交上游解决；本地同步经影响分析、受审 PR 和证据。治理改动单独审查。
10. **No Overengineering**。按当前范围选用最小可验证、可维护的实现，并保持未来回归主仓的路径可追溯。

宪法约束研发过程。违反约束时停止，获得符合 Authority 的调整后再继续。宪法改动需显式版本、影响、独立审计及 Owner 合并。
