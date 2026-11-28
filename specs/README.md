# Frontend implementation specifications

使用官方 Spec Kit 1.2.1 的 sequential 编号和 `fe-` slug，例如 `001-fe-example` 对应 FE-001。以 CLI 生成的路径为准，使用 `SPECIFY_FEATURE_DIRECTORY` 选择当前目录。正式流程及人员隔离见工程验收规范。单独获审的 PR 将允许路径登记在 `.specify/implementation-ownership.json`，使用文件或以斜杠结尾的目录前缀，最长匹配，所有者为 feature 目录名数组。

- `spec.md` 含 `**Slice**: FE-NNN` 与 `**Kind**: BUSINESS|ENGINEERING`。在 Upstream Traceability 下以 `[AUTH:V1-TECHNICAL] V1-C36` 形式逐行引用实际源标识或标题。Authority Unit ID 由 registry 给出。BUSINESS Slice 至少引用一个 upstream canonical product/technical selector（例如 Uxx、V1-Cxx、V1-Dxx、Axxxx、010xx）；Frontend Experience Authority 可以补充，但不能成为业务行为的唯一依据。ENGINEERING 不能豁免业务追溯。所有 Spec 必须声明 `**Business Semantics**: NONE|CHANGED`，并在 `## Business Semantics Assessment` 说明实际范围。BUSINESS 必须为 CHANGED；ENGINEERING 若新增或改变用户可观察业务语义也须 CHANGED。CHANGED 同时引用 V1-PRODUCT canonical requirement 和 V1-TECHNICAL 的 `Phase N：原文标题`（N=1–6），在 `## Backend and Contract Dependencies` 登记后端依赖和 `[CONTRACT] METHOD /真实路径`，缺失时写 `[CONTRACT] GAP: 原因及阻断`。NONE 使用 `**Phase**: NOT APPLICABLE` 并解释工程依据。静态脚本只核覆盖和一致性；Audit 1 / Audit 2 必须检查谎报 NONE 或 ENGINEERING。
- `plan.md` 包含范围、以 `[ALLOW] path` / `[FORBID] path` 逐行记录的允许/禁止路径、依赖、适用验证和 STOP 条件；Checklist 与 Analyze evidence 交 Audit 1。
- `tasks.md` 使用 `- [ ] T001 描述 [REQ:V1-C36] [VERIFY:test:tests/example.test.mjs]`。REQ 与 spec 实际 selector 一致。Verification type 支持 `test`、`device`、`visual`、`manual`；历史 `[VERIFY:tests/example.test.mjs]` 继续按 `test` 解析。
- `test` 必须引用真实 `tests/**/*.test.mjs` 自动测试。非自动验证使用 `tests/evidence/*.json`，例如 `[VERIFY:device:tests/evidence/device.json]`，须记录同类型 `type`、`result: "PASS"`、非空 `reference`、准确 `base`、`candidateFiles`、冻结 `design`、`observedAt`、`environment`、实际 `operations`、`artifacts`、`defects`、`unverified`。结构见下文。机器通过仅证明证据结构与版本绑定，独立 Audit 2 必须读取实际截图/录屏/操作和设备证据；不得凭 PASS JSON 或 CI 代替体验判断。
- 实现 PR 的 `.specify/change-binding.json` 包含 `repository`、`feature`（目录名）和 `files`（实际变更路径到 SHA-256）。本轮工具只允许含可核验目标内容的绑定。需要删除、跨 Slice 实现或调整历史已完成任务时先单独评估并修改治理合同。
- `.specify/task-evidence.json` 包含相同 repo 和 feature、准确基线 `base`、`binding`（binding 文件的 SHA-256）、`tasks`（每个本次完成的 ID 到 `taskDigest` 和 `files`）。taskDigest 为 tasks.md 该行去除 `- [x] ` 的 UTF-8 SHA-256。验证引用必须出现在本次 diff 和对应任务中；非自动 evidence 的接受结果还由治理器读取验证。实际执行结果看当前 head 的 CI；已合并证明通过 Git 历史及原 PR 保存。历史 PR 的成功结果不替代当前测试。

Authority 同步的 `.specify/sync-impact.json` 包含 `repository` 和 `snapshots` 对象，每个变化种类记录 `previous`、`next`（源 SHA）、精确变化 `files`、影响说明 `rationale` 和实际下游改动 `changedSpecArtifacts`。当前基线没有业务 Slice 或已完成任务。

## Audit 1 实现准入

规划 PR 在 `specs/<feature>/` 合入冻结的 `spec.md`、`plan.md`、`checklist.md`、`tasks.md`、`analyze.md` 和 Plan AI 2 的 `audit1.json`。运行工作流前显式设置 `SPECIFY_FEATURE_DIRECTORY`。工作流检查文件与治理后停在审查门，由 Plan AI 2 提供实际审核记录。通过的记录包含 `feature`、`role: "Plan AI 2"`、`decision: "PASS"`、可追溯 `evidence` 及 `artifacts`，后者将上述五个文件名映射到 UTF-8 SHA-256。另需 `semanticAssessment: {businessSemantics, rationale, evidence}`，由 Plan AI 2 对声明与实际行为进行审查；不得仅凭 Kind 字段批准免除业务 Authority。计算 tasks 摘要时仅将任务完成框规范化为 `[ ]`。实现门禁从目标基线读取准入记录，并比对实际规划内容；CI 核验版本绑定，审核人身份和判断由正式评审确认。

Change Binding 的 `kind` 使用 `implementation`，若涉及共享工程文件则使用 `shared-engineering`。两类实现均需要同一冻结计划的路径允许、已先行登记的所有权和当前 Task Evidence。普通实现包括小程序 `apps/miniprogram/` 和相应测试。根目录共享工程配置为有限名单，应用构建脚本可在 `scripts/build/`，通用工程工具可在 `scripts/engineering/`。可在正常规划 PR 中登记所需共享路径，再随实现一并交付其变更。治理规则、CI 和验证入口属于治理变更，未知路径直接失败。新增路径类别经治理评审。

## 静态验收配置

TypeScript 从仓库根 `tsconfig.json` 执行检查。配置直接声明检查范围和编译标准，禁止通过 `extends` 或 project references 委托配置。新增源目录、平台类型或调整编译选项时，可通过仅修改 `tsconfig.json` 的独立治理 PR 提交，也可按现行门禁与直接相关的前端工程 Authority、`specs/<feature>/` 规划工件、Authority 下游影响记录及工程批准记录同 PR 共同交付，不得混入实现代码或无关治理改动。审查核对代码覆盖范围和检查标准。后续 Slice 从已合入该配置的基线开展实现。

## Authority 下游影响记录

新增导入文件由目标基线的 Registry 准入。已登记但尚无文件和 manifest 条目的 Authority 可以保持待同步。验证 PR 时将准确目标 SHA 传入 `GOVERNANCE_BASE`。本地快照验证默认信任已检出的 HEAD。

导入或本地工程 Authority 的文件发生变化时，门禁使用目标基线的 Unit Registry 和 `spec.md` 引用推导待评估清单。按文件评估全部基线引用，即使引用标题未变或在候选移除。无引用时可省略下游记录。已有引用时，同步 PR 须更新 `.specify/authority-downstream-impact.json`：

- `repository` 为本仓，`base` 为准确基线 SHA。 `authority` 是按路径排序的 `[路径, 基线 Git blob（新增为 null）, 候选 Git blob]` 列表。
- `specs` 以完整 `spec.md` 路径为键，覆盖全部推导出的引用。每条列出 `disposition`、`rationale`、可追溯的独立 `evidence` 和实际 `changedArtifacts`（完整规划工件路径）。 `unchanged` 需要说明规则变化为何不改变该 Spec 的义务，此时保留原工件和既有 Audit 1。 `converged` 更新 Spec 及实际受影响的 Plan、Tasks 或其他准入工件。理由应交代保留工件为何仍适用。
- 已存在 Audit 1 的收敛项需要 Plan AI 2 提供新的证据，重新绑定五份工件，并写入 `authorityImpact`。其值为 `JSON.stringify({base, authority})` 的 UTF-8 SHA-256。审核前尚未准入的 Spec 仍按正常流程获得首次 Audit 1。已完成任务及既有交付证据由任务门禁和 Git 历史保留。

机器核对覆盖和版本，不根据标题判断语义。审查人对评估决定与证据负责。


## 当前候选的体验与设备证据

非 test 验收记录的 `candidateFiles` 必须精确列出 Change Binding 中排除 `tests/evidence/` 后的全部路径及 SHA-256；证据及媒体因此无需自引用摘要或自身最终 commit SHA。`base` 绑定当前目标基线。`design` 为非空 `{unit, selector, sha256}` 数组，指向 Registry 中实际冻结文件和内容摘要。`observedAt` 为真实观察时间，`environment` 描述构建、后端、设备/系统/微信/基础库/DevTools（按适用范围）。`operations` 是非空 `{action, expected, actual}` 数组，记录操作过程和真实结果。

`artifacts` 为 `{path, sha256}` 数组，引用本次候选实际提交、已纳入 Ownership / Allowed Paths / Change Binding / Task Evidence 的 `tests/evidence/` 图片、录屏或日志（png/jpg/jpeg/webp/mp4/mov/txt/log）。visual/device 至少一份适用媒体；manual 按实际适用性记录，不强造截图。`defects` 显式列 `{description, blocking}`；存在 blocking defect 不能完成该验收任务。`unverified` 必须显式记录，非空时不能以 PASS 完成任务，保持 BLOCKED / DEFERRED。

以上是完整性门禁，不是图像真实性或体验语义判定器。Audit 2 必须对最终 Exact Head 读取媒体、逐项重核适用交互和冻结设计，检查五个质量维度、关键体验时刻、独立一票否决、Signature Experience、Reality First 与 Growth World 删除测试。历史结果不得冒充当前结果；候选或设计变化使摘要失配时重新取证。当前没有应用代码，本轮不提交实际体验、视觉或真机 PASS。

## Upstream freshness

本地 integrity 重算 pinned 字节；`authority:check --remote` / `contract:check --remote` 同时验证 pinned 来源和真实上游 main 的相关 blob。完整性错误与 `STALE` 漂移区分；无关 main 提交不阻断。受影响的规划/开发准入及同步在 remote governance 中必须通过 freshness；纯治理修复可先提交，不能据此授权业务实现。相关变更先完成完整影响评估和独立同步 PR，不自动覆盖 Authority。Step 4 路径以正式主仓 `Docs/frontend/design-system/` 与 `Docs/frontend/screens/` 为准，仍需独立 Registry 准入与已批准来源；现有 Step 3 screens 文件不重新分类。
