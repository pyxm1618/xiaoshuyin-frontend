# Frontend implementation specifications

使用官方 Spec Kit 1.2.1 的 sequential 编号和 `fe-` slug，例如 `001-fe-example` 对应 FE-001。以 CLI 生成的路径为准，使用 `SPECIFY_FEATURE_DIRECTORY` 选择当前目录。正式流程及人员隔离见工程验收规范。单独获审的 PR 将允许路径登记在 `.specify/implementation-ownership.json`，使用文件或以斜杠结尾的目录前缀，最长匹配，所有者为 feature 目录名数组。

- `spec.md` 含 `**Slice**: FE-NNN`。在 Upstream Traceability 下以 `[AUTH:V1-TECHNICAL] V1-C36` 形式逐行引用实际源标识或标题。Authority Unit ID 由 registry 给出。
- `plan.md` 包含范围、以 `[ALLOW] path` / `[FORBID] path` 逐行记录的允许/禁止路径、依赖、适用测试和 STOP 条件；Checklist 与 Analyze evidence 交 Audit 1。
- `tasks.md` 使用 `- [ ] T001 描述 [REQ:V1-C36] [VERIFY:tests/example.test.mjs]`。REQ 与 spec 实际 selector 一致。
- 实现 PR 的 `.specify/change-binding.json` 包含 `repository`、`feature`（目录名）和 `files`（实际变更路径到 SHA-256）。本轮工具只允许含可核验目标内容的绑定。需要删除、跨 Slice 实现或调整历史已完成任务时先单独评估并修改治理合同。
- `.specify/task-evidence.json` 包含相同 repo 和 feature、准确基线 `base`、`binding`（binding 文件的 SHA-256）、`tasks`（每个本次完成的 ID 到 `taskDigest` 和 `files`）。taskDigest 为 tasks.md 该行去除 `- [x] ` 的 UTF-8 SHA-256。验证文件必须出现在本次 diff 和对应任务中。实际执行结果看当前 head 的 CI；已合并证明通过 Git 历史及原 PR 保存。历史 PR 的成功结果不替代当前测试。

Authority 同步的 `.specify/sync-impact.json` 包含 `repository` 和 `snapshots` 对象，每个变化种类记录 `previous`、`next`（源 SHA）、精确变化 `files`、影响说明 `rationale` 和实际下游改动 `changedSpecArtifacts`。当前基线没有业务 Slice 或已完成任务。
