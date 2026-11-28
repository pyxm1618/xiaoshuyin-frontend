# Plan — FE-001 — WeChat Runtime & Typed Transport Entry

## Upstream Traceability

[AUTH:ARCHITECTURE] 18. API 契约与前端提效边界
[AUTH:V1-TECHNICAL] 2. V1 最终技术栈
[AUTH:V1-TECHNICAL] 3. 代码组织
[AUTH:FE-ENGINEERING] Owner 确认的实施决策与外部 Authority 依赖

FR-001 / AC-01–02：原生微信 TypeScript/WXML/WXSS，现有“小树荫助手”主体/AppID（EAD-01），仅验证入口，不继承历史代码。

[AUTH:FE-ENGINEERING] 工具和运行环境
[AUTH:V1-TECHNICAL] 27A. API 契约与强类型客户端
[AUTH:FE-ENGINEERING] 目录和依赖方向

FR-002/003/007 / AC-03/04/08：采用微信原生 `wx.request` + 最小薄强类型 Transport Adapter，直接消费 `packages/generated/openapi.d.ts`（`paths`/`operations`/`components`，同源 `openapi.json` 约束 HTTP 语义）；禁止第二套 DTO/schema、Fetch Polyfill 与通用 Networking Framework。先以独立 T005/T006 原生 `wx.request` 普通 HTTP 真机兼容门槛验证后再准入正式 Transport，原 `openapi-fetch` 历史 BLOCKED 证据保持原样。

[AUTH:FE-ENGINEERING] 请求、可靠性与隐私

FR-004/005/006 / AC-05/06/07：请求所有权、有界生命周期、Owner 失效与晚到成功/失败回调隔离、脱敏、真实响应与取消。

[AUTH:V1-TECHNICAL] 28.1 身份与家庭
[AUTH:FE-INTEGRATION] 源文件、合同与同步
[AUTH:FE-INTEGRATION] 联调边界

FR-003/005 / AC-03/05：仅 `GET /api/v1/me`，实际 Backend 合同与合法隔离合成测试身份。

[AUTH:V1-TECHNICAL] 18.4 微信小程序 Chunked Streaming Contract

FR-006/007 / AC-07/08：独立 `wx.request`（`enableChunked` / `onChunkReceived`）平台探针与普通 HTTP Probe 分别实测，不提前实现生产 Streaming Parser 或 AI Run Recovery。

[AUTH:FE-ENGINEERING] 验证与性能
[AUTH:FE-ENGINEERING] 正式应用测试与治理自测
[AUTH:FE-DELIVERY] 适用验收
[AUTH:FE-DELIVERY] 体验验收证据与独立判断
[AUTH:FE-DELIVERY] Slice 语义声明与实现准入
[AUTH:FE-INTEGRATION] Freshness 与准入

AC-01–09：适用测试、真实平台、证据绑定、准入与独立审计。冻结 Step 1–3 体验与产品责任不改；本 Slice 不交付正式用户旅程，`Step 4 Dependency: NONE`。

## Constitution Check

1 Authority First：以当前 Registry/manifest、冻结 Spec（待 Owner 精确内容批准的候选）与实际上游 blob 为准；不写后端。
2 One Source of Truth：现有 `getMe` 合同与服务端身份事实唯一；仅工程探针读取，不推导授权、业务状态或家庭资格。
3 Spec-Driven Development：本 PR 仅规划收敛与工程 Authority 候选；待 `specs/README.md` 同步、Owner 精确批准、Audit 1 续期与精确基线 CI 合入后才可恢复实现；Developer 不能自审 Audit 2。
4 Slice-Bounded Delivery：仅 FR-001–007、AC-01–09，依下列有限路径。
5 Traceability：实际 selector、任务、验证、Ownership、Change Binding 与 Task Evidence 一一可核验。
6 Evidence Before Completion：真实编译、真机、Backend、chunk、测试与 exact-head CI；未知/缺失不通过。
7 Privacy/Safety/Compliance：合成隔离数据、最小权限、凭证仅临时内存；不发布敏感内容。
8 Experience Integrity：无正式产品页面、导航、业务旅程或视觉设计，工程页面不伪造业务状态；未来业务 Slice 仍保留所有冻结质量门禁。
9 Explicit Change Control：不兼容、相关上游漂移或路径/治理需求先 STOP，单独受审。
10 No Overengineering：一个 native bootstrap、一个最小薄强类型 `wx.request` Adapter、最少生命周期控制、一个独立普通 HTTP Probe 与一个独立 chunk probe；不建立平台框架。

ENGINEERING / Business Semantics NONE / Phase NOT APPLICABLE / Step 4 NONE。读取现有 self-read 合同及工程运行状态不改变业务能力、授权、持久化、用户业务行为；测试凭证不是 Session 实现。

## Scope Contract

### Allowed Paths

下列路径已由 PR #13 在 `.specify/implementation-ownership.json` 注册，为正式实现阶段允许路径上限。目录内仅实际最小文件，不是新增其他功能的授权，且无需创设已不再需要的依赖或文件。

[ALLOW] apps/miniprogram/app.ts
[ALLOW] apps/miniprogram/app.json
[ALLOW] apps/miniprogram/app.wxss
[ALLOW] apps/miniprogram/platform.d.ts
[ALLOW] apps/miniprogram/pages/bootstrap/
[ALLOW] apps/miniprogram/transport/
[ALLOW] apps/miniprogram/probes/
[ALLOW] project.config.json
[ALLOW] package.json
[ALLOW] bun.lock
[ALLOW] tests/fe-001/
[ALLOW] tests/evidence/fe-001/

`project.config.json` 只承载最小原生项目根、受控原生编译配置与 Owner 允许登记的既有 AppID（`wx746a39363f67ae95`）；新方案零第三方运行时 npm 依赖，不得加入私有配置、凭证或生成的 `miniprogram_npm`/构建输出。`platform.d.ts` 仅引用获准的真实官方微信平台类型（`miniprogram-api-typings@5.3.1`），不伪造 `wx` / Fetch 实现。`transport/` 仅含最小薄强类型 `wx.request` Adapter 与有限请求生命周期，不含 `openapi-fetch`、Fetch Polyfill、session、业务 DTO、通用框架。`probes/` 仅技术验收入口（普通 HTTP Probe 与 Chunked Probe），不得发布为正式产品能力。测试路径只含本 Slice 的测试和类型负例；证据路径只含该 Slice 的脱敏证据（且新候选 T005/T006 使用独立证据路径，原 `openapi-fetch` BLOCKED 历史记录原样保留）。

### Forbidden Paths

[FORBID] Docs/
[FORBID] packages/generated/
[FORBID] apps/server/
[FORBID] apps/operations/
[FORBID] apps/miniprogram/session/
[FORBID] apps/miniprogram/pages/home/
[FORBID] apps/miniprogram/pages/progress/
[FORBID] apps/miniprogram/pages/me/
[FORBID] apps/miniprogram/miniprogram_npm/
[FORBID] tests/bootstrap.test.mjs
[FORBID] tsconfig.json
[FORBID] .github/
[FORBID] .agents/
[FORBID] scripts/
[FORBID] specs/
[FORBID] .specify/

现有门禁明确允许实现 PR 在冻结 `tasks.md` 仅更新完成框，并写 `.specify/change-binding.json` / `.specify/task-evidence.json`；这三个治理元数据不是实施 Allowed Paths 的业务文件。禁止改其他规划内容、Authority、Registry、CI、验证入口或治理规则。正式登录/Session/家庭/身份、Home/Progress/Me、导航、Focus Flow、AI streaming/recovery/parser、TDesign 全面建设、状态管理/重试框架、运营、漫画/媒体、Foundation Hardening、Step 4、FE-002 全部排除。禁止修改任何后端仓内容。

## Dependencies

### A — planning admission (current)

当前核验基线：Frontend Main `c1d6b2eff79b6d50ad845ce404a2d5a603c477bb`（PR #22 合并后 CI run `46099080689` 6/6 PASS）；Backend Main `47b3d16b89d8e77d3b8e1b907a3df359cd2f26e7`（最新变化仅涉及 Consent、Compliance 与 Problem Formulation 整改，未修改已导入 Authority 或生成合同文件，按实际 Freshness 规则核验不触发同步）；Authority source manifest `1c5b64012c0b9c5b173d67eabc3acfaae9450f6c`（9/9 远端 `CURRENT`）；Contract source manifest `9a1589a88729be46eadf81279d8a1eb7628cf29b`（2/2 远端 `CURRENT`）。OpenAPI 3.1.0 / `info.version 0.1.0-plan`：`openapi.json` blob `68d3b9e620a9fc291d21b3b830ba426a3bc13101`（SHA-256 `9ce501df305fd767b37d6831d09ef94ebc60eac435b18f820958c868c96e6903`），`openapi.d.ts` blob `84fc009cbf7beaca193987d3e6b33ebda1148bc7`（SHA-256 `ddfac7b93787c1ec9a4ba370ee8c699a1230cb0f74f3fd17aee1b4e37690630d`）。

候选规划分支 `plan/001-fe-transport-authority-reconciliation` 承载 Plan AI 1 的工程 Authority 与 Spec 定向修订（`V1前端工程技术设计.md` SHA-256 `e1f3824acb9e5ca308fd0f403881c4ccbc0ad12731dad08458b0a2d042257184`、`前后端合同与集成规范.md` SHA-256 `512e44b5e2bb5d79864efce101098c8ac08d1fedfa0e5284966a1b5d95f967fd`、`spec.md` SHA-256 `29d1ab08e499520e2bec123e8119e5a576558e547160172309aa9235c2838d2f`）、Plan AI 2 下游规划收敛、`.specify/authority-downstream-impact.json`、经联合编译实证的根 `tsconfig.json` 修订及续期 Audit 1。原 Developer Head `8c72fcf231148623c1e6e027989f32692181413b` 上的 Bootstrap、测试、类型负例及 `openapi-fetch` 真机 BLOCKED 证据保留作历史追溯，不作为新候选 PASS。`specs/README.md` 最小文档同步 PR #22（`c1d6b2eff79b6d50ad845ce404a2d5a603c477bb`）已由 Owner 合并并 6/6 PASS，本分支已基于该 Main 收敛 `authority-downstream-impact.json` 的 `base` 与 `audit1.json` 的 `authorityImpact`。Owner 对本 PR 两份工程 Authority 的精确 before/after SHA-256 已明示批准并按 `.specify/engineering-authority-approval.json` 落盘。本规划 PR 仍待：
1. 在最终基线上通过 exact-head CI 六项并完成独立 Audit 1 复审；
2. 由 Owner 合并本规划 PR。
上述准入依赖、Owner 批准事实、锁定工具链联合编译证据与 PATCH 平台风险探针均已分别记录，不以候选 CI 或模拟批准冒充最终结果。

### B — developer admission prerequisites (status on Main c1d6b2e & current planning convergence)

1. **Implementation Ownership（已具备）**：PR #13（`f66748b4dc29766678081ac34c6cad8598ea75a9`）已在 `.specify/implementation-ownership.json` 为 `001-fe-wechat-runtime-transport` 登记了全部 12 条 Allowed Paths。无需重新申请 Ownership 或重建 Registry；开发交付仅在已登记范围的最小实际子集内进行（且不安装/保留不需要的 `openapi-fetch`）。若未来确需超出已登记范围的新路径，必须 STOP 并另行提交治理变更。
2. **Static TypeScript Config & 临时例外撤销（范围已具备；目标配置随本轮收敛）**：PR #14（`618c84d9d2d1925118c110f519985bfc22b4997f`）已将根 `tsconfig.json` 检查范围扩展至 `packages/generated/openapi.d.ts`、`apps/miniprogram/**/*.ts`、`tests/fe-001/contract.types.ts`。PR #16（`31cb32f02e8492942241b0b1aa2e00088bf978fa`）曾引入仅适用于 `openapi-fetch 0.17.0` + `miniprogram-api-typings 5.3.1` 联合冲突的临时例外（`lib: ["ES2020", "DOM"]`、`skipLibCheck: true`）。Plan AI 2 已在隔离工作区按锁定工具链（Node `26.13.0`、Bun `1.4.4`、TypeScript `5.9.3`、Vitest `3.2.7`、`miniprogram-api-typings 5.3.1`）完成实际联合编译验证（最新 Main `openapi.d.ts`、Developer 原生应用入口、原生 `wx.request` 最小探针编译上下文及正反例 `contract.types.ts`），确认移除 `openapi-fetch` 与 `"DOM"` 后，恢复 `lib: ["ES2020"]`、`skipLibCheck: false` 并保留 `strict: true`、`exactOptionalPropertyTypes: true`、`noUncheckedIndexedAccess: true`、`noEmit: true`、`types: []` 达到 `tsc` 退出码 0（0 错误）且 5 类 `@ts-expect-error` 负例 5/5 真实触发并由 Vitest PASS。依 PR #20 生效的 `scripts/governance.mjs` 规则，目标 `tsconfig.json` 修订随本工程 Authority 规划 PR 共同交付；Developer 不得重新引入 `"DOM"` 或 `skipLibCheck: true`。
3. **Test Entry & Fail-Closed Guard（已具备）**：PR #15（`0a61c068dc9d0c124d00969f80b70f3b705e2ba5`）已在 `scripts/verify-all.mjs` 分离并保留 `node --test tests/bootstrap.test.mjs` 治理自测，并对任何存在 `apps/miniprogram`、`project.config.json` 或 `tests/fe-001` 的应用候选执行 fail-closed 检查（强制 `scripts['test:app'] === 'vitest run tests/fe-001'` 及精确 `vitest@3.2.7`）。无需重建测试平台或修改治理脚本/CI。Developer 实施包仅在 `package.json` 添加非受保护脚本 `"test:app": "vitest run tests/fe-001"`，并锁定 `vitest@3.2.7`、`typescript@5.9.3`、`miniprogram-api-typings@5.3.1`（不得引入 `openapi-fetch`）。
4. **开发前重读基线**：正式开发恢复前，须重新读取合并后的最新 `main`、已批准规划工件精确摘要、`.specify/implementation-ownership.json` 与远端新鲜度检查；禁止越权路径或未批准重构 Foundation。
5. **外部运行与环境依赖（Developer 验收门槛）**：Owner/授权操作人提供既有 AppID（`wx746a39363f67ae95`）、微信开发者工具及目标真机访问、指定隔离非生产后端、合法预置测试凭证与受控 Chunked 流源。规划阶段不宣称上述依赖通过；任一缺失将阻断相应开发验收任务，不得用 mock 或模拟替代。

### C — Developer execution dependencies & contract

锁定工具链：Node `26.13.0`、Bun `1.4.4`、TypeScript `5.9.3`、Vitest `3.2.7`、`miniprogram-api-typings` `5.3.1`（精确版本与 `bun.lock` 可复现；`bun install --frozen-lockfile`）。不安装 `openapi-fetch`、Fetch Polyfill 或任何网络框架；不使用 DevTools npm 打包链路。

`GET /api/v1/me` — `operationId: getMe`，`bearerAuth`，无 request body 或 path/query/header/cookie parameters（Bearer 通过 Header 传输，不伪造操作参数）。200 `application/json` `MeResponse` 包含 `account`（`id`/`createdAt`/`status: ACTIVE|DISABLED`）、`person`（`id`/`createdAt` 及可选字段）；401 `Error`（`code`/`message` 必填，`details` 可选），`UNAUTHENTICATED`。后端源码 `apps/server/api/src/routes/me.ts` blob `520ed19156bf2ec2c30addc057c66dd253297c7f`，`plugins/auth.ts` 校验 Bearer/有效账户/epoch/person 与 `SELF_IDENTITY`。`VERIFIED-IN-TEST` / `APPROVED-FOR-TARGET` 均为 NOT VERIFIED；联调须由后端操作人带外提供合成绑定身份与临时凭证，记录部署 SHA、合同身份、非生产地址及脱敏结果，不写入代码/日志/URL/fixture。隔离 Chunked 流源须为经批准的非生产定时分块端点，不得新增虚假 AI Run API；`GET /api/v1/ai-runs/{id}/stream` 与 `GET /api/v1/ai-runs/{id}` 缺失且明确 DEFERRED。

### Implementation sequence — TEST-FIRST

严格保持原顺序：`T001→T002→T003→T004→T005→T006 (hard gate)→T007→T008→T009→T010→T011→T012→T013→T014`。

- **T001–T002 (RED)**：在具备已合入规划基线后，首先基于新候选薄强类型 `wx.request` 契约签名更新/定义 `tests/fe-001/contract.types.ts` 与 `contract.test.mjs`（正例 `getMe` 200/401 及带参数/Body 合约检验；5 类 `@ts-expect-error` 负例覆盖非法 Path、Method、Parameters、Body 与 Response Field，并在 `lib: ["ES2020"]`、`skipLibCheck: false` 下全量编译与逐条剥离校验），并定义 `lifecycle.test.mjs` 与 `probe.test.mjs` RED 断言及真机/HTTP/Chunked 操作规程。初始 RED 记录真实失败边界，不靠破坏无关导入凑 RED。
- **T003–T004 (Native Bootstrap & Device)**：保留/复用原 Developer 分支的合法原生入口（`app.ts`、`app.json`、`app.wxss`、`platform.d.ts`、`pages/bootstrap/`），移除旧 `openapi-fetch` 专用 Probe 与依赖，在微信 DevTools 编译并在目标真机运行当前候选 Bootstrap；记录设备/OS/微信/基础库/DevTools 版本与真实媒体。
- **T005–T006 (Hard Gate — 原生 `wx.request` 普通 HTTP Probe，独立于 T007)**：
  - T005 在正式 Transport 实现之前执行，不得形成对 T007 正式 Adapter 的循环依赖！直接在 `apps/miniprogram/probes/runtime/` 通过原生 `wx.request` 行使普通 HTTP 能力（请求成功、方法/路径/参数及必要 Header、HTTP 状态码读取、响应读取、HTTP 错误与网络错误区分、有界超时、`RequestTask.abort` 显式取消、成功/失败/完成回调行为及平台限制）。不采用模拟器、Node 或浏览器替代真机。必须记录成功、失败、完成以及取消/超时相关回调，并在该独立最小 HTTP Probe 中明确断言同一请求仅产生一次有效终态；以适用的延迟响应、取消或超时场景观察晚到回调，验证其不改变已结算结果。分别记录真实平台回调观察与 Probe 自身最小结果隔离行为；未观察到晚到回调不得直接视为已验证隔离能力，未验证的 FR-002 强制义务不得 PASS。这里只实现未来技术探针的最小隔离，不提前实现 T007 Adapter；完整 Owner 失效、竞态、资源清理与生命周期矩阵仍由 T007–T009 承担。
  - T005 同时执行最小 PATCH 平台兼容性风险探针（后续业务依赖风险验证，不是 FE-001 新增整体硬门槛）：对经批准的隔离技术探针 HTTP endpoint 发送 `PATCH`（仅探针，不调用正式业务写入接口），在目标真实微信 Runtime 观察是否真实发送，并以服务端观察记录确认实际收到的 HTTP Method，而非仅凭客户端回调判断；记录实际请求方法、响应、错误、微信版本及官方类型限制。须分别判断运行时支持情况与正式强类型实现可行性；如探针需要绕开官方类型限制，仅允许明确隔离的诊断手段，不得污染正式 Adapter 或伪造平台声明，不得引入 Method Override、第二套 DTO、通用网络框架或无约束类型断言。独立 PATCH PASS / FAIL / NOT VERIFIED 及证据如实写入 `wx-request-compatibility.json` 的 `operations`；真实限制或未验证风险可同时记录于 `blocking: false` 的 `defects`，非阻断 PATCH 风险不计入全局 `unverified`。全局 `unverified` 仍须准确记录全部未完成的强制验收义务；仅当原有普通 HTTP 及 FR-002 强制验收均真实通过、无 blocking defect 且全局 `unverified` 为空时，T005/T006 才允许 PASS。PATCH FAIL / NOT VERIFIED 不得表述为支持。当前生成合同存在 `PATCH /api/v1/families/{id}/members/{personId}`（`updateMemberProfile`）与 `PATCH /api/v1/cases/{id}/digital-use/contract/drafts/{version}`（`updatePhoneUseContractDraft`）；若 PATCH 不支持或无法验证，仅记录真实限制、不宣称 PATCH 可用、向 Chief Planner 报告受影响的两个 Operation（必要时转交后端负责人），并只阻断依赖相关接口的后续业务能力，不阻断已满足原有验收义务的 FE-001，也不自行修改后端合同。
  - T006 基于 T005 真实真机证据作出兼容决策，必须明确覆盖 FR-002 全部前置验收义务（含单次结算与晚到回调隔离）；T005/T006 使用独立新候选证据路径 `tests/evidence/fe-001/wx-request-compatibility.json`（及对应媒体/日志）与 `tests/evidence/fe-001/wx-transport-decision.json`，原 `openapi-fetch` 的 `runtime-compatibility.json`、`runtime-compatibility.log`、`transport-decision.json` BLOCKED 历史记录原样保留，不得覆盖或充当新候选 PASS。若不兼容，立即 STOP T007 起实现并提交定向工程变更请求。
- **T007–T009 (GREEN — 最小薄强类型 Transport Adapter & Lifecycle)**：仅在 T006 兼容门槛 PASS 后，在 `apps/miniprogram/transport/` 实现消费 `packages/generated/openapi.d.ts`（type-only import）与原生 `wx.request` 的最小薄强类型 Transport Adapter（禁止 `any`、无约束断言、第二套 DTO/schema、Fetch Polyfill 或通用网络框架）及请求所有者生命周期（有限正超时、`RequestTask.abort`、单次结算、清理、Owner 失效与代际守卫隔离晚到成功/失败回调，未知/失败/取消不视为成功）。使 `contract.test.mjs` 与 `lifecycle.test.mjs` 跑通 GREEN 并完成 T009 真机失败/取消/晚到回调矩阵验证。
- **T010 (Real Backend Integration)**：使用同一正式 Transport 对指定隔离非生产后端实测 `GET /api/v1/me` 合法预置凭证 200 `MeResponse` 与无凭证 401 `UNAUTHENTICATED` `Error`；记录部署 SHA、合同身份、环境与脱敏证据；不用 mock/fixture/healthz 替代。
- **T011–T012 (Independent Chunked Streaming Probe)**：在 `apps/miniprogram/probes/` 保持隔离的 `wx.request`（`enableChunked: true` / `onChunkReceived`）字节与时序探针，运行 `probe.test.mjs` GREEN，并在目标真机连接受控非生产定时流源验证完整响应结束前的多次 chunk 到达（含相对时间戳）、字节读取、完整响应对照、取消/中断及适用切后台/网络变化；不提前实现生产 Streaming Parser、AI Run Recovery 或业务渲染。
- **T013–T014 (Final Candidate Refresh & Audit 2 Handoff)**：对最终代码候选在目标真机重新编译与复测（更新并绑定 `final-device.json` 及受影响证据，采集真实包大小/启动/请求测量），执行 `bun install --frozen-lockfile`、`authority:check -- --remote`、`contract:check -- --remote`、`governance:check`、`typecheck`、`test`、`test:app`、`verify-all` 及适用联调命令，生成精确 Change Binding 与 Task Evidence，在精确 Head CI 全绿后移交独立 Audit 2。所有任务在规划阶段保持 `[ ]` 未勾选。

## Verification Plan

Engineering Correctness APPLICABLE：`bun install --frozen-lockfile`；Node `26.13.0` / Bun `1.4.4` / TypeScript `5.9.3` / Vitest `3.2.7` / `miniprogram-api-typings` `5.3.1`；`bun run authority:check`；`bun run contract:check`；`bun run authority:check -- --remote` 与 `bun run contract:check -- --remote`；`bun run governance:check` 与 `node scripts/governance.mjs --remote`（精确 `GOVERNANCE_BASE`）；`bun run typecheck`（`lib: ["ES2020"]`, `skipLibCheck: false`）；`bun run test`（Node 治理自测）；`bun run test:app`（Vitest 3.2.7）；`bun run verify-all` 与当前 CI 矩阵。运行真实 RED/GREEN 检查及 5 类负例独立编译器检查，不降低断言。

Business / Contract Correctness：合同部分 APPLICABLE，真实 200/401/强类型/错误语义；无业务语义改变。
Experience Correctness：正式业务旅程与体验质量门禁 NOT APPLICABLE（仅工程 Bootstrap，无产品 UX）；工程生命周期与错误区分仍 APPLICABLE，完整保留未来 Experience Quality Gate，不修改 Step 4。
Visual Fidelity：NOT APPLICABLE（无产品视觉或正式页面）；真机媒体证据仍 REQUIRED。
Real-device Acceptance APPLICABLE：实际 DevTools 编译 + Simulator + 指定目标真机；覆盖原生 Bootstrap、T005 新候选 `wx.request` 普通 HTTP Probe、真实生命周期矩阵、指定非生产后端 `/api/v1/me`、独立 Chunked Probe 与最终候选复测；双端目标时均须验证；记录真实测量、限制与脱敏情况。

Evidence files：
- 自动测试与类型契约：`tests/fe-001/contract.test.mjs`、`tests/fe-001/lifecycle.test.mjs`、`tests/fe-001/probe.test.mjs`、`tests/fe-001/contract.types.ts`（含辅助本地测试桩如 `probe-server.mjs`）。
- 正式证据记录：`tests/evidence/fe-001/native-build.json`（manual）、`wx-request-compatibility.json`（device，新候选 T005，含普通 HTTP 与 PATCH 风险探针的方法/响应/错误/版本/限制及 PASS/FAIL/NOT VERIFIED 记录）、`wx-transport-decision.json`（manual，新候选 T006）、`lifecycle-device.json`（device）、`backend-me.json`（device）、`chunk-device.json`（device）、`final-device.json`（device）、`engineering.json`（manual）。
- 历史证据原样保留：`tests/evidence/fe-001/runtime-compatibility.json`、`runtime-compatibility.log`、`transport-decision.json`（原 `openapi-fetch 0.17.0` BLOCKED 历史事实，不复用为新候选 PASS）。

Each non-test JSON per `specs/README.md`：`type`、`result`、`reference`、精确 `base`、`candidateFiles`（等于 Change Binding 中排除 `tests/evidence/` 的全部路径与 SHA-256）、`design`（非空真实 Registry unit/selector/完整文件 SHA-256）、`observedAt`、`environment`、`operations`（`action`/`expected`/`actual`）、`artifacts`（绑定 diff 中实际路径与 SHA-256，device 至少一份当前候选真实适用媒体）、`defects`（`description`/`blocking`）、`unverified`（PASS 时必须为空）。独立 Audit 2 绑定最终 Exact Head 并核验媒体与实测。本规划阶段不含任何实际 PASS 证据。

## STOP Conditions

1. 在 `specs/README.md` 文档同步合入、Owner 精确批准（`.specify/engineering-authority-approval.json`）、Plan AI 2 Audit 1 续期及本规划 PR 合入前，禁止恢复正式开发或进入 T005/T007。
2. 相关上游 Authority 或 OpenAPI 合同漂移、出现未登记路径、Ownership 缺失、或冻结规划/摘要不匹配时立即 STOP，禁止自授权修改。
3. T005/T006 新候选原生 `wx.request` 普通 HTTP Probe 若无法满足合同语义、状态码/响应读取、错误区分或 `RequestTask.abort` 取消要求，立即 STOP T007 起正式实现，记录真实证据并提交定向技术 Authority 变更请求。
4. 若指定非生产后端不可达、部署不匹配或缺少合法隔离预置凭证，STOP 依赖的 AC-05，严禁使用 mock/fixture/healthz 替代。
5. 若目标真机无法观察到完整响应结束前多次 chunk 交付或无批准流源，STOP AC-07 并如实记录限制与未验证项，严禁宣称生产流式就绪。
6. 任何阻断性缺陷、未验证项、缺失测试/真机/CI 证据或环境版本不符时，禁止标记任务完成或 PASS；不得越权引入 Session/缓存/重试/TDesign/FE-002/Step 4；Audit 2 不得由 Developer 或 Plan AI 替代；Owner 掌控合并。
7. T005 的 PATCH 平台兼容性探针若 FAIL 或无法验证，按事实记录并报告受影响的 `updateMemberProfile` 与 `updatePhoneUseContractDraft`；不得宣称 PATCH 可用、不得自行改后端合同或引入 Method Override 等替代，仅阻断依赖这两个 PATCH 的后续业务能力，不据此阻断 FE-001 原有验收义务。
