# Frontend implementation specifications

使用官方 Spec Kit 1.2.1 的 sequential 编号和 `fe-` slug，例如 `001-fe-example` 对应 FE-001。以 CLI 生成的路径为准，使用 `SPECIFY_FEATURE_DIRECTORY` 选择当前目录。正式流程及人员隔离见工程验收规范。单独获审的 PR 将允许路径登记在 `.specify/implementation-ownership.json`，使用文件或以斜杠结尾的目录前缀，最长匹配，所有者为 feature 目录名数组。

- `spec.md` 含 `**Slice**: FE-NNN`。在 Upstream Traceability 下以 `[AUTH:V1-TECHNICAL] V1-C36` 形式逐行引用实际源标识或标题。Authority Unit ID 由 registry 给出。
- `plan.md` 包含范围、以 `[ALLOW] path` / `[FORBID] path` 逐行记录的允许/禁止路径、依赖、适用测试和 STOP 条件；Checklist 与 Analyze evidence 交 Audit 1。
- `tasks.md` 使用 `- [ ] T001 描述 [REQ:V1-C36] [VERIFY:tests/example.test.mjs]`。REQ 与 spec 实际 selector 一致。
- 实现 PR 的 `.specify/change-binding.json` 包含 `repository`、`feature`（目录名）和 `files`（实际变更路径到 SHA-256）。本轮工具只允许含可核验目标内容的绑定。需要删除、跨 Slice 实现或调整历史已完成任务时先单独评估并修改治理合同。
- `.specify/task-evidence.json` 包含相同 repo 和 feature、准确基线 `base`、`binding`（binding 文件的 SHA-256）、`tasks`（每个本次完成的 ID 到 `taskDigest` 和 `files`）。taskDigest 为 tasks.md 该行去除 `- [x] ` 的 UTF-8 SHA-256。验证文件必须出现在本次 diff 和对应任务中。实际执行结果看当前 head 的 CI；已合并证明通过 Git 历史及原 PR 保存。历史 PR 的成功结果不替代当前测试。

Authority 同步的 `.specify/sync-impact.json` 包含 `repository` 和 `snapshots` 对象，每个变化种类记录 `previous`、`next`（源 SHA）、精确变化 `files`、影响说明 `rationale` 和实际下游改动 `changedSpecArtifacts`。当前基线没有业务 Slice 或已完成任务。

## Audit 1 实现准入

规划 PR 在 `specs/<feature>/` 合入冻结的 `spec.md`、`plan.md`、`checklist.md`、`tasks.md`、`analyze.md` 和 Plan AI 2 的 `audit1.json`。运行工作流前显式设置 `SPECIFY_FEATURE_DIRECTORY`。工作流检查文件与治理后停在审查门，由 Plan AI 2 提供实际审核记录。通过的记录包含 `feature`、`role: "Plan AI 2"`、`decision: "PASS"`、可追溯 `evidence` 及 `artifacts`，后者将上述五个文件名映射到 UTF-8 SHA-256。计算 tasks 摘要时仅将任务完成框规范化为 `[ ]`。实现门禁从目标基线读取准入记录，并比对实际规划内容；CI 核验版本绑定，审核人身份和判断由正式评审确认。

Change Binding 的 `kind` 使用 `implementation`，若涉及共享工程文件则使用 `shared-engineering`。两类实现均需要同一冻结计划的路径允许、已先行登记的所有权和当前 Task Evidence。普通实现包括小程序 `apps/miniprogram/` 和相应测试。根目录共享工程配置为有限名单，应用构建脚本可在 `scripts/build/`，通用工程工具可在 `scripts/engineering/`。可在正常规划 PR 中登记所需共享路径，再随实现一并交付其变更。治理规则、CI 和验证入口属于治理变更，未知路径直接失败。新增路径类别经治理评审。

## Authority 下游影响记录

导入或本地工程 Authority 的文件发生变化时，门禁使用目标基线的 Unit Registry 和 `spec.md` 引用推导待评估清单。按文件评估全部基线引用，即使引用标题未变或在候选移除。无引用时可省略下游记录。已有引用时，同步 PR 须更新 `.specify/authority-downstream-impact.json`：

- `repository` 为本仓，`base` 为准确基线 SHA。 `authority` 是按路径排序的 `[路径, 基线 Git blob（新增为 null）, 候选 Git blob]` 列表。
- `specs` 以完整 `spec.md` 路径为键，覆盖全部推导出的引用。每条列出 `disposition`、`rationale`、可追溯的独立 `evidence` 和实际 `changedArtifacts`（完整规划工件路径）。 `unchanged` 需要说明规则变化为何不改变该 Spec 的义务，此时保留原工件和既有 Audit 1。 `converged` 更新 Spec 及实际受影响的 Plan、Tasks 或其他准入工件。理由应交代保留工件为何仍适用。
- 已存在 Audit 1 的收敛项需要 Plan AI 2 提供新的证据，重新绑定五份工件，并写入 `authorityImpact`。其值为 `JSON.stringify({base, authority})` 的 UTF-8 SHA-256。审核前尚未准入的 Spec 仍按正常流程获得首次 Audit 1。已完成任务及既有交付证据由任务门禁和 Git 历史保留。

机器核对覆盖和版本，不根据标题判断语义。审查人对评估决定与证据负责。
