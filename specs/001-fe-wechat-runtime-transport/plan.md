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

FR-002/003/007 / AC-03/04/08：openapi-fetch 真机先证实，直接消费 generated paths/operations/components，禁止第二套 DTO。实际依赖 exact patch。

[AUTH:FE-ENGINEERING] 请求、可靠性与隐私

FR-004/005/006 / AC-05/06/07：有界生命周期、所有者失效、脱敏、真实响应和取消。

[AUTH:V1-TECHNICAL] 28.1 身份与家庭
[AUTH:FE-INTEGRATION] 源文件、合同与同步
[AUTH:FE-INTEGRATION] 联调边界

FR-003/005 / AC-03/05：仅 GET /api/v1/me，实际 Backend 合同与合法隔离身份。

[AUTH:V1-TECHNICAL] 18.4 微信小程序 Chunked Streaming Contract

FR-006/007 / AC-07/08：隔离 wx.request 平台 probe，不提前实现生产流/恢复。

[AUTH:FE-ENGINEERING] 验证与性能
[AUTH:FE-ENGINEERING] 正式应用测试与治理自测
[AUTH:FE-DELIVERY] 适用验收
[AUTH:FE-DELIVERY] 体验验收证据与独立判断
[AUTH:FE-DELIVERY] Slice 语义声明与实现准入
[AUTH:FE-INTEGRATION] Freshness 与准入

AC-01–09：适用测试、真实平台、证据绑定、准入与独立审计。冻结 Step 1–3 体验与产品责任不改；本 Slice 不交付正式用户旅程，Step 4 Dependency NONE。

## Constitution Check

1 Authority First：以当前 Registry/manifest、冻结 Spec 和实际上游 blob 为准；不写后端。
2 One Source of Truth：现有 getMe 合同与服务端身份事实唯一；仅工程探针读取，不推导授权、业务状态或家庭资格。
3 Spec-Driven Development：本 PR 仅规划，Audit 1 与五份冻结工件合入、独立准入后才可实现；Developer 不能自审 Audit 2。
4 Slice-Bounded Delivery：仅 FR-001–007、AC-01–09，依下列有限路径。
5 Traceability：实际 selector、任务、验证、Ownership、Change Binding 与 Task Evidence 一一可核验。
6 Evidence Before Completion：真实编译、真机、Backend、chunk、测试与 exact-head CI；未知/缺失不通过。
7 Privacy/Safety/Compliance：合成隔离数据、最小权限、凭证仅临时内存；不发布敏感内容。
8 Experience Integrity：无正式产品页面、导航、业务旅程或视觉设计，工程页面不伪造业务状态；未来业务 Slice 仍保留所有冻结质量门禁。
9 Explicit Change Control：不兼容、相关上游漂移或路径/治理需求先 STOP，单独受审。
10 No Overengineering：一个 native bootstrap、一个小型 typed transport、最少生命周期控制、一个独立 chunk probe；不建立平台框架。

ENGINEERING / Business Semantics NONE / Phase NOT APPLICABLE / Step 4 NONE。读取现有 self-read 合同及工程运行状态不改变业务能力、授权、持久化、用户业务行为；测试凭证不是 Session 实现。

## Scope Contract

### Allowed Paths

仅在规划合入、所有权及准入完成后，下列是实施路径上限。目录内仅实际最小文件，不是新增其它功能的授权。

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

project.config.json 只承载最小原生项目根、受控编译/npm 打包配置与 Owner 允许登记的既有 AppID；不得加入私有配置、凭证或生成的 miniprogram_npm/构建输出。platform.d.ts 仅引用获准的真实平台类型，不伪造 wx / Fetch 实现。transport/ 不含 session、业务 DTO、通用框架。probes/ 仅技术验收入口；不得发布为正式产品能力。测试路径只含本 Slice 的测试和类型负例；证据路径只含该 Slice 的脱敏证据。没有当前用途的允许文件无需创建。

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

现有门禁明确允许实现 PR 在冻结 tasks.md 仅更新完成框，并写 .specify/change-binding.json / .specify/task-evidence.json；这三个治理元数据不是实施 Allowed Paths 的业务文件。禁止改其他规划内容、Authority、Registry、CI、验证入口或治理规则。正式登录/Session/家庭/身份、Home/Progress/Me、导航、Focus Flow、AI streaming/recovery/parser、TDesign 全面建设、状态管理/重试框架、运营、漫画/媒体、Foundation Hardening、Step 4、FE-002 全部排除。禁止修改任何后端仓内容。

## Dependencies

### A — planning admission (current)

Frontend main 76e103ddd156f0210afb80f8fda54e9b4c2df5cc; backend main d043d07a5d9a3aa3766ff54a1582358fe5ad905c; PR #12 initial head fc0b63a776e51344d71e6a73c11ba6037acd0893; spec blob 8b410037180fbb4383c5ee3d5567934a429e5556. Current source manifest e8b1d490fc8dab5af6cffaf30a5651fc7f6304f7 (9 Authority blobs current), contract 9a1589a88729be46eadf81279d8a1eb7628cf29b (2 blobs current). OpenAPI 3.1.0/info 0.1.0-plan, JSON blob 68d3b9e620a9fc291d21b3b830ba426a3bc13101 SHA256 9ce501df305fd767b37d6831d09ef94ebc60eac435b18f820958c868c96e6903; d.ts blob 84fc009cbf7beaca193987d3e6b33ebda1148bc7 SHA256 ddfac7b93787c1ec9a4ba370ee8c699a1230cb0f74f3fd17aee1b4e37690630d. Recheck current upstream and local integrity at admission/implementation. This plan uses tracked Spec Kit 1.2.1 templates via GitHub API; setup-plan/setup-tasks/check-prerequisites shell and frontend-audit1 workflow CLI are not executed in this environment. Remote read-back + existing exact-head CI verify file presence/structure/freshness; manual Audit 1 must bind actual five file digests. Not a claim of CLI execution; Owner/Chief review formal path difference before admission.

### B — developer admission prerequisites (not changes in this PR)

1. Owner merges approved planning PR after exact-head checks and Chief review. Then a separately reviewed Ownership-only change registers the exact paths above (only actual needed subset; feature key 001-fe-wechat-runtime-transport). Current owners={} and governance validates owners against an existing feature and against target base, so cannot implement before registration. Shared package.json/bun.lock/project.config.json registration may be reviewed with planning under existing rule, but this PR intentionally contains only planning files; register with the other paths after planning merge, coordinate any shared changes. No ownership changes alongside implementation.
2. Existing tsconfig includes generated d.ts and apps/miniprogram/**/*.ts, strict, noEmit, ES2020, moduleResolution Bundler, types:[], no DOM. It does not include the external type-negative fixture tests/fe-001/contract.types.ts. A separate tsconfig.json-only governance PR is genuinely needed for that coverage and platform type approval. Extend include only to that fixture; review actual openapi-fetch declaration requirements for standard Fetch/Request/Response/Headers/Abort types, add only necessary compiler lib(s) if required. Keep strict/exactOptionalPropertyTypes/noUncheckedIndexedAccess/noEmit, types:[], original application/type-fixture coverage, and no extends or references. Owner-approved FE-001-only exception (PR #16 technical change note, https://github.com/pyxm1618/xiaoshuyin-frontend/pull/16#issuecomment-7189409062): allow lib:["ES2020","DOM"] with skipLibCheck:true solely to accommodate the measured joint declaration conflict between TypeScript 5.9.3, openapi-fetch 0.17.0 and official miniprogram-api-typings 5.3.1; Developer reported exit 2 / 11 diagnostics without skipLibCheck and exit 0 with it, after testing alternative official typings versions and other approaches. skipLibCheck skips full declaration-file type checking globally, not merely those 11 diagnostics. Compensation is mandatory: retain the generated OpenAPI types as sole contract type source, no any or unconstrained assertions to bypass the contract, and independently compile the real contract fixture and its five meaningful negative variants (path, method, query parameters, body, response field) with explicit skipLibCheck:false and the retained strict options; keep the existing application test and full root typecheck coverage. This exception does not authorize local Fetch declarations, alternate transport, further compiler relaxation or scope expansion; T005–T006 real target Runtime Compatibility Gate and all original acceptance obligations remain hard gates. Recheck the measured joint compile and applicable checks in the separately reviewed tsconfig-only PR and keep the compensation in the Developer candidate. The exact official WeChat typings package shall be selected and locked after checking actual declarations (explicit scoped reference via platform.d.ts under types:[] if suitable); no tsconfig-only PR may refer to a not-yet-installed package in a way that breaks CI. If standard lib and platform declarations conflict, STOP and resolve via reviewed minimal typing decision, not ambient fake runtime globals or any casts. Type availability never proves device runtime availability. Validate the reviewed config before implementation; do not alter here.
3. Existing package.json test is node --test 'tests/**/*.test.mjs'; governance requires VERIFY:test paths ending .test.mjs, thus Vitest files would be collected by Node. Existing verify-all only calls protected scripts; CI invokes verify-all plus Node test. A separate minimal verification governance PR is required before app tests: scope protected test to existing Node governance self-test tests/bootstrap.test.mjs, retain it; extend existing verify-all/CI invocation to run the explicit Vitest application command when the first application/test candidate exists (fail closed if any app/test source is present but command/dependency/test files absent, no silent skip, no weakening of current six required jobs). Before application exists only mark application suite not applicable; review positive/negative guard and retain all governance self-tests. The protected script change must not be mixed with package dependency edits (governance.mjs protectedScripts checks JSON equality after removing protected keys); the existing Bootstrap Verification job can invoke the enhanced verify-all without new job or ruleset. If actual reviewed CI wiring requires a minimal workflow change, keep it in that separate governance PR; no new governance system. Implementation package adds non-protected test:app (e.g. vitest run tests/fe-001), exact Vitest 3.2.7, exact verified openapi-fetch and official platform typing patches only, lock with Bun 1.4.4. Do not install deps during planning. No duplicate Node/Vitest app tests. Verify no app tests can be accidentally skipped and no empty-suite pass.
4. Before any Developer code, re-read actual merged main, prerequisite PRs, Ownership, planning digests and fresh authority; approved change paths may be a subset only. If any required actual path outside plan emerges, stop for targeted plan/ownership change and renewed Audit 1, not self-authorization. No Foundation reopening.
5. Owner/authorized operator identify actual existing AppID, DevTools and target device access, isolated test backend and credential provisioning/controlled stream source owners and access route. Do not require their actual runtime PASS at planning or engineering bootstrap admission; if not available for a dependent action, that action remains BLOCKED. No new AppID, production credentials, backend code changes or fake API.

### C — Developer execution dependencies & contract

Node 26.13.0, Bun 1.4.4, TS 5.9.3; exact direct dependencies, frozen lockfile. Backend bun.lock at d043… resolves Vitest 3.2.7. openapi-fetch patch and official typings patch are not fixed in current baseline; Developer records source, exact resolved versions, compatibility constraints before probe. Use actual DevTools-supported npm packaging, record reproducible build route; no generated output committed, no bundler platform. If impossible within authorized minimal scope, STOP.

GET /api/v1/me — operationId getMe, bearerAuth, no request body or path/query/header/cookie params in generated operation (Bearer via security/header, not fabricated operation parameter). 200 application/json MeResponse requires account (id/createdAt/status ACTIVE|DISABLED), person (id/createdAt; optional accountBound/profile/values per actual schema); 401 Error (code/message required, details optional), UNAUTHENTICATED. Source apps/server/api/src/routes/me.ts blob 520ed19156bf2ec2c30addc057c66dd253297c7f, app.ts registers auth and me, plugins/auth.ts validates real Bearer/active account/epoch/person, requireSelfAction SELF_IDENTITY and transaction-bound self-read. No client token minting, backend secrets, login, authz replica or fake response. Actual backend operator supplies approved pre-provisioned synthetic bound identity and temporary test credential out-of-band; record deployed SHA and contract identity, nonproduction domain/TLS/allowlist without disabling required checks. Contract-listed only; VERIFIED-IN-TEST/APPROVED-FOR-TARGET NOT VERIFIED. Deployment mismatch or missing credential blocks integration, not planning. Validate actual JSON against existing OpenAPI schema (test-only direct source inspection/validation; no second DTO/schema; no new validator framework unless independently approved necessary), status/media type/code, redact values. No credential, identifiers or payload in logs/media/fixture/URL/public storage; clear from memory after operation. Use controlled delayed/HTTP error/network scenarios, not fabricated backend contract. Isolated chunk stream source must be approved nonproduction technical endpoint with timed separate writes, no AI Run API. GET /api/v1/ai-runs/{id}/stream and GET /api/v1/ai-runs/{id} absent, DEFERRED and not required for probe; production gateway pass-through/parser/recovery NOT VERIFIED.

### Implementation sequence — TEST-FIRST

T001–002 RED: after prerequisites, define real Vitest tests for typed entry/lifecycle/observable errors and TS positive/negative fixture; define real device/HTTP/chunk procedures and expected observations before implementation. Verify failing assertions or missing target at first executable boundary (no unrelated broken import counted as full RED); record initial failure and negative compiler checks; only minimal bootstrap needed to execute platform tests may precede those platform runs. T003 GREEN minimal native app config, app, single engineering bootstrap page; compile actual DevTools, simulator, target device (T004). Use engineering controls only; no formal UI/nav. Record target platform matrix and exact patch/versions. T005–006 device compatibility probe before formal transport: test actual library construction/invocation, Request/Response/Headers/Fetch behavior as applicable, success/HTTP error, rejection, response reading, abort including signal to RequestTask if needed; minimal scoped platform bridge only if same openapi-fetch semantics verified, not a separate fallback transport or generic polyfill. Probe may be throwaway/scoped. Record observable behavior, runtime errors, limits and decision. No Node/browser/mock substitution. On incompatibility STOP T007 onward and submit targeted upstream technical Authority change request; wx.request thin adapter is only candidate requiring approval.

T007–008 GREEN: implement typed client via openapi-fetch<paths> directly importing generated types (type-only import); contract method/path/params/errors unchanged. Minimal owner-local request handle with finite positive deadline, cancel/abort, single settlement, cleanup, owner invalidation and generation/identity guard before state updates; no session epochs/retries/cache/global state. Tests assert timeout, network vs HTTP vs cancel classification, unknown/malformed response not success, cancel before/after completion, owner termination and delayed callback isolation; test both response and failure callbacks racing cancellation/timeout, no duplicate settlement, late callback cannot update obsolete owner. Run Vitest RED/GREEN then minimal REFACTOR only with tests green; use deterministic synthetic fakes only to prove logic, actual platform evidence T009. Type negative tests use @ts-expect-error with valid baseline and deliberate wrong method/path/parameters/no-body; unused directive must fail. Check typed data/error shapes and no any/unbounded casts or duplicated types. Validate with actual compiler. T010 real backend integration 200 and 401 via same formal transport on target device; if automatable, isolated Vitest integration with actual designated deployment and secret injection; absent environment must report not run and block AC-05, never mark mock as real. T011–012 chunk procedure defined before probe; separate wx.request enableChunked/onChunkReceived byte probe records monotonic relative arrivals (multiple before final response), full buffered control, bytes and cancellation/interruption including applicable background/network switch; no parser/business rendering/recovery. T013 re-run final candidate native build/device and prior compatibility/lifecycle/integration/chunk evidence if candidateFiles changed; verify no regressions, real device constraints and actual package size/startup/request measurements (no invented thresholds). T014 final engineering proof, all applicable commands/tests, candidate binding and exact-head CI; Audit 2 separately after Developer completion. All tasks initially unchecked.

## Verification Plan

Engineering Correctness APPLICABLE: bun install --frozen-lockfile; node/bun/tsc locked versions; bun run authority:check; bun run contract:check; bun run authority:check -- --remote and bun run contract:check -- --remote (or exact node scripts/upstream.mjs authority|contract --remote); bun run governance:check and node scripts/governance.mjs --remote with exact GOVERNANCE_BASE; bun run typecheck; bun run test (Node governance); bun run test:app (Vitest 3.2.7 after approved entry); bun run verify-all and current CI matrix. Run actual red/green checks at appropriate task; failing negatives must be expected and meaningful, no lowering assertions. Real integration test command when supplied deployment/credential; document explicit environment and result, not CI fake.
Business / Contract Correctness: contract portion APPLICABLE, real 200/401/typed/failure semantics; no changed business semantics or user workflow.
Experience Correctness: formal business journey and quality gate NOT APPLICABLE because only diagnostic bootstrap, no product UX; engineering lifecycle/failure distinction still APPLICABLE. Preserve frozen future Experience Quality Gate, no Step 4 changes.
Visual Fidelity NOT APPLICABLE; no visual design or formal screens. Device evidence still required.
Real-device Acceptance APPLICABLE: actual DevTools compilation and simulator + designated physical target(s), recorded device/OS/WeChat/base library/DevTools/app candidate and actual environment. Cover native build, ordinary HTTP probe before implementation, real lifecycle cases, actual test backend and isolated chunk; if owner targets both platforms, both actual target environments must be validated; do not invent minimum versions or extrapolate untested devices. Record measurements, limitations and privacy.

GitHub API can author code/planning/commits/read-back (only planning here); CI can run static/governance/integrity/freshness/Vitest with approved entry and no credentials unless authorized isolated secret setup; CI cannot replace actual DevTools/device operations or real nonproduction endpoint. Developer may coordinate authorized platform operator; record who/what/when/where and candidate evidence. No requirement that one local AI performs all.

Evidence files: tests/fe-001/contract.test.mjs, lifecycle.test.mjs, probe.test.mjs and contract.types.ts (TS compiler fixture); tests/evidence/fe-001/native-build.json, runtime-compatibility.json, transport-decision.json, lifecycle-device.json, backend-me.json, chunk-device.json, final-device.json, engineering.json. Native-build manual includes actual DevTools compile and simulator. runtime-compatibility, lifecycle-device, backend-me, chunk-device and final-device are device; transport-decision and engineering are manual. Media in same evidence directory; minimum one real current-candidate media per device record (e.g. redacted video/screenshot/log appropriate to operation), no fabricated media; evidence of controlled chunk timeline must distinguish early chunk vs final success. Final evidence refresh must preserve chronology of early compatibility proof; if implementation changes candidate content, re-run compatibility on final candidate, retain early proof and final binding. Node/Vitest tests do not prove platform behavior. Backend real evidence includes HTTP 200/401, schema assertion, deployment/contract identity, credential isolation, observedAt, operation outcomes. No actual PASS evidence in planning.

Each non-test JSON per specs/README: type, result, reference, exact base, candidateFiles equal all Change Binding files outside tests/evidence/, design nonempty actual registry unit/selector/full authority SHA256, observedAt, environment string, operations action/expected/actual, artifacts path+sha256 in bound diff, defects description/blocking, unverified. A PASS requires no blocking defects and empty unverified; no self-referential head. Use FE-ENGINEERING/FE-DELIVERY selectors listed above, FE-INTEGRATION or V1-TECHNICAL sections for relevant checks (compute actual whole-file digests). Change Binding repository/feature/kind shared-engineering if package/lock/project config change, files exact implementation/shared diff SHA256. Task Evidence base, binding file SHA256, each newly completed task digest of line without '- [x] ', files includes its VERIFY and all delivered paths covered across tasks. Candidate changes refresh binding/media/checks; no task marked complete before actual verification. Exact-head CI after final commit independent of manual evidence record; current audit binding excludes audit1.json itself, normalized task boxes.

## STOP Conditions

No implementation until planning/admission merged and independently reviewed prerequisites approved. Stop for actual relevant authority/contract drift, unexpected paths, ownership missing, changed frozen planning or missing real test conditions for dependent tasks; no self-authorized edits. Stop formal transport if real openapi-fetch compatibility not proven or semantics cannot be preserved. Submit actual evidence and targeted Authority request; no unilateral replacement. STOP dependent AC-05 for inaccessible/incorrect actual Backend, legal isolated credential missing or mismatch; no mock/healthz substitution. STOP AC-07 if no real chunk before completion or no approved stream source; no production readiness claim. Stop completion for unresolved applicable defect, unknown/failed evidence, missing required test/device/CI, or drift; no fabricated PASS. No Step 4/FE-002, no Audit 2 by Developer or Plan AI, Owner controls merge.
