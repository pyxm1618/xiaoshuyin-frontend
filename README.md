# 小树荫前端

小树荫 V1 原生微信小程序的独立工程仓库。阅读 [开发规则](AGENTS.md)、[冻结体验索引](Docs/frontend/README.md)、[工程与验收规范](Docs/frontend/engineering/V1前端开发与验收规范.md) 和 [API 合同同步规范](Docs/frontend/engineering/前后端合同与集成规范.md)。

## 验证

安装 Node 26.13.0 和 Bun 1.4.4，运行：

```sh
bun install --frozen-lockfile
bun run verify-all
```

验证包括 Authority、API 合同、Spec 治理、TypeScript 和自动化自测。对候选分支校验实际差异时使用 `GOVERNANCE_BASE=<exact-main-sha> bun run governance:check --remote`。正式 CI 针对候选 head 运行。Application build、后端联调、E2E、视觉和真机为 DEFERRED，由适用 Slice 启用。当前基线尚未包含正式应用入口或运行环境变量依赖。

## Spec Kit

```sh
uvx --from git+https://github.com/github/spec-kit.git@0d1be13ed486b6f5737806af24299d5242773b1f specify version
uvx --from git+https://github.com/github/spec-kit.git@0d1be13ed486b6f5737806af24299d5242773b1f specify integration status
```

官方版本 v1.2.1，generic、skills、sh、sequential。技能位于 `.agents/skills/`，按 [规格入口](specs/README.md) 在各自授权的 AI 上下文中执行。官方 generic 属于 IDE/agent prompts 集成，bundled `speckit` 工作流无法命令行派发。各角色在独立上下文运行技能。计划产物齐全后，运行 `specify workflow run .specify/workflows/frontend-audit1.yml`，官方工作流引擎检查前置条件和治理并停在 Audit 1 审查门。工作流选择需有对应审计证据。

仓库保护的预期配置见 `.specify/repository-ruleset-contract.json`。用 `node scripts/check-ruleset.mjs` 核验 GitHub 上的有效规则与真实检查名，并由管理员读取实际 bypass 列表。
