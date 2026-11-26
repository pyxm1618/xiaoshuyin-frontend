# Spec — FE-001 — WeChat Runtime & Typed Transport Entry

**Slice**: FE-001
**Kind**: ENGINEERING
**Business Semantics**: NONE
**Phase**: NOT APPLICABLE
**Step 4 Dependency**: NONE

## Upstream Traceability

[AUTH:ARCHITECTURE] 18. API 契约与前端提效边界
[AUTH:V1-TECHNICAL] 2. V1 最终技术栈
[AUTH:V1-TECHNICAL] 3. 代码组织
[AUTH:FE-ENGINEERING] Owner 确认的实施决策与外部 Authority 依赖

以上约束 FR-001：原生微信端、工程入口、既有主体及 AppID，名称按 EAD-01 使用“小树荫助手”，不继承历史代码、不假设迁移需求。

[AUTH:FE-ENGINEERING] 工具和运行环境
[AUTH:V1-TECHNICAL] 27A. API 契约与强类型客户端
[AUTH:FE-ENGINEERING] 目录和依赖方向

以上约束 FR-002、FR-003、FR-007：真实平台兼容性、生成合同唯一类型来源、最小依赖及技术决策边界。

[AUTH:FE-ENGINEERING] 请求、可靠性与隐私

约束 FR-004、FR-005、FR-006：请求所有权、有界生命周期、脱敏、真实响应及中断处理。本 Slice 仅承担工程范围，不提前实现 actor/session 业务。

[AUTH:V1-TECHNICAL] 28.1 身份与家庭
[AUTH:FE-INTEGRATION] 源文件、合同与同步
[AUTH:FE-INTEGRATION] 联调边界

以上约束 FR-003、FR-005：已存在的 operation、合同语义、真实非生产联调及权限隔离。

[AUTH:V1-TECHNICAL] 18.4 微信小程序 Chunked Streaming Contract

约束 FR-006、FR-007：分块平台行为单独实测；生产 parser、网关端到端流式与恢复合同留给依赖该能力的后续 Slice。

[AUTH:FE-ENGINEERING] 验证与性能
[AUTH:FE-ENGINEERING] 正式应用测试与治理自测
[AUTH:FE-DELIVERY] 适用验收
[AUTH:FE-DELIVERY] 体验验收证据与独立判断
[AUTH:FE-DELIVERY] Slice 语义声明与实现准入
[AUTH:FE-INTEGRATION] Freshness 与准入

以上约束 AC-01–AC-09：适用测试、真实设备及证据、阶段隔离、合同新鲜度与独立验收。正式产品体验和视觉验收在适用业务 Slice 承担；本 Slice 不引入产品设计。

## Business Semantics Assessment

本 Slice 仅建立原生微信工程运行入口，验证冻结技术方案和现有 HTTP 合同，提供最小强类型通信、请求生命周期及平台技术探针。Bootstrap 仅为工程验证，不属于正式用户页面；GET /api/v1/me 只用合法合成测试身份读取现有合同事实，不建立身份、Session、授权或家庭业务，不改变服务器行为、权限、用户可观察业务语义、状态转换及持久化事实。依 FE-ENGINEERING 的工具和运行环境、目录和依赖方向及 FE-DELIVERY 的语义声明，Kind 为 ENGINEERING、Business Semantics 为 NONE、业务 Phase 不适用。Audit 1 独立复核此判断。Step 4 不构成本 Slice 依赖。

## Backend and Contract Dependencies

[CONTRACT] GET /api/v1/me

当前生成合同 operationId 为 getMe，bearerAuth，无 request body；200 application/json 为 MeResponse，401 application/json 为 Error（UNAUTHENTICATED）。后端现有实现 apps/server/api/src/routes/me.ts（blob 520ed19156bf2ec2c30addc057c66dd253297c7f）。源代码存在与 CONTRACT-LISTED 不代表已部署、VERIFIED-IN-TEST 或 APPROVED-FOR-TARGET。

Specify 基线：
- Frontend main: 76e103ddd156f0210afb80f8fda54e9b4c2df5cc
- Backend main: d043d07a5d9a3aa3766ff54a1582358fe5ad905c
- Imported Authority source: e8b1d490fc8dab5af6cffaf30a5651fc7f6304f7
- Contract source: 9a1589a88729be46eadf81279d8a1eb7628cf29b
- OpenAPI 3.1.0 / info.version 0.1.0-plan
- packages/generated/openapi.json: Git blob 68d3b9e620a9fc291d21b3b830ba426a3bc13101; SHA-256 9ce501df305fd767b37d6831d09ef94ebc60eac435b18f820958c868c96e6903
- packages/generated/openapi.d.ts: Git blob 84fc009cbf7beaca193987d3e6b33ebda1148bc7; SHA-256 ddfac7b93787c1ec9a4ba370ee8c699a1230cb0f74f3fd17aee1b4e37690630d

相关受控文件须在规划/实现准入时按 manifest 与当前真实上游 blob 重新核验；无关 main 变化不自动触发同步，相关变化遵循独立影响评估与同步流程。

联调依赖实际指定的隔离测试 Backend、部署 SHA、合同身份、合法最小权限预置凭证和合成测试数据。当前 VERIFIED-IN-TEST / APPROVED-FOR-TARGET 均 NOT VERIFIED；实际联调条件未满足时阻断 AC-05 和依赖该证据的交付，不用 mock 或 healthz 替代。

延期边界（不属于 FE-001 必需 operation）：当前生成合同未公开 GET /api/v1/ai-runs/{id}/stream 与 GET /api/v1/ai-runs/{id}。生产 AI Run 流式交付、恢复和相关网关/授权端到端验收 DEFERRED，直到正式合同同步、真实部署及相应证据具备；该缺口阻断依赖它的后续 Slice，而不阻断 FE-001 的隔离平台 chunk probe。不得创建虚假 AI Run API 或将技术探针作为业务合同。

## Scope

目标：建立足够小的原生微信运行入口和直接消费 generated OpenAPI types 的最小 HTTP Transport，通过真实 Runtime Confirmation 判断冻结方案，令 FE-002 在独立准入后可直接承接身份、Session、授权及家庭业务。本 Slice 不交付正式用户业务或产品视觉。

### FR-001 — Native Runtime Entry

在 apps/miniprogram/ 建立最小原生微信小程序入口，使用 TypeScript / WXML / WXSS，真实 DevTools 编译、Simulator 和目标真机运行。沿用 Owner 确认的小树荫助手及现有 AppID；按全新代码处理，不要求复用历史代码。Bootstrap 页面仅服务工程验证，不属于正式页面或导航。

### FR-002 — Runtime Compatibility Confirmation

在目标真实微信 Runtime 验证冻结的 openapi-fetch 方案，覆盖适用 Request、Response、Fetch 行为、请求取消、响应读取与错误处理；记录实际平台、工具、客户端、基础库版本、覆盖范围及限制。普通 HTTP 与 chunked probe 分别取证，不以 Node/浏览器或模拟器代替目标真机。

### FR-003 — Typed Transport Entry

直接消费 packages/generated/openapi.d.ts 的生成类型，HTTP 语义依据同源 openapi.json，保持方法、路径、参数、响应及错误语义。禁止重复 DTO/schema、无约束类型断言掩盖不匹配及提前构建通用 Networking Framework。依 FR-007 决定正式实现。

### FR-004 — Request Lifecycle

最小通信入口具备有界超时、显式取消、网络失败、HTTP 错误、请求所有者生命周期及失效请求晚到响应隔离。请求所有者结束后不得再更新其状态；取消、未知、失败不可视为成功。HTTP 错误与网络/取消/超时区别处理。不得提前实现 Session 世代管理、全局重试或业务状态管理平台。

### FR-005 — Real Backend Communication

使用 GET /api/v1/me 对实际非生产测试 Backend 验证合法预置测试凭证的 HTTP 200 与合同响应、无凭证 HTTP 401 与合同错误。记录部署 SHA、合同身份、环境与脱敏操作结果。凭证通过合法隔离方式提供，不写入代码、日志、fixture、URL 或公共存储；不收集真实家庭资料。不得提前实现登录、Session 或身份业务。healthz 不得单独替代正式 Typed Transport 合同验收。真实合同变化依当前 Authority 及正式影响评估处理。

### FR-006 — Chunked Runtime Probe

用 wx.request、enableChunked、onChunkReceived 在明确隔离的技术探针与非生产受控流源验证真实分块交付、字节读取、取消和中断，以及适用的切后台、网络变化。观察多个 chunk 在完整响应结束前到达，并与完整响应缓冲区分；记录实际交付行为与限制。不得实现生产 Streaming Parser、AI Run Recovery 或增量业务渲染，不得新增虚假 AI Run API，不以平台探针证明生产流式 readiness。

### FR-007 — Transport Decision Boundary

openapi-fetch 是当前技术 Authority。先取得 FR-002 的真实兼容性证据，兼容且保持合同语义方可继续正式 Transport 实现；不能满足则 STOP 正式 Transport 实现，提交真实证据及 targeted technical authority change request，等待正式批准。wx.request + thin typed transport adapter 只是候选替代，未获批准不得当作正式实现。任何批准方案仍以 generated OpenAPI types 为唯一 Contract Type Authority。不因普通 HTTP 验证通过而宣称 AI 流式交付就绪。

### Engineering dependencies and phase boundary

- 遵循冻结工程工具版本 Node 26.13.0、Bun 1.4.4、TypeScript 5.9.3；直接依赖 exact version、lockfile 可复现。
- 首个正式应用测试接入范围仅限 Transport、请求生命周期和适用自动化联调，采用主仓锁定 Vitest 3.2.7（本次 backend main bun.lock 实际解析版本）；保留 Node 治理自测，不迁移无关测试，不建立通用测试平台。涉及验证入口或 CI 的必要接入遵守既有独立治理规则，不由本 Spec 自动批准治理变更。
- 若需要新增平台类型或调整 tsconfig.json，先依现有独立 tsconfig.json-only 治理 PR 规则办理；未批准不得扩大检查范围或修改基线。
- 实现路径 Ownership 在适用后续阶段仅登记实际需要的最小路径；本 Spec 不修改注册表或批准实现。
- 目标 DevTools、真机、基础库和测试部署、凭证、探针流源是 Developer 验收依赖，不是 Specify 阶段运行条件。实际缺失时对应开发验收 BLOCKED，不伪造。
- Step 4: NONE；正式用户体验、视觉及业务旅程不适用，仍须完成本 Slice 工程、合同、生命周期与真机验收。

## Non-goals

正式登录、Session、家庭及身份业务；Home / Progress / Me 正式页面；正式导航和 Focus Flow；AI Chat、完整 AI Streaming / Recovery；Design System、TDesign 全面建设；通用 Networking Framework、全局状态管理平台；Backend Domain Logic、Backend API 重新设计、第二套 DTO/schema；漫画、教学媒体或媒体基础设施；运营后台实现；Foundation Hardening、治理系统重构；FE-002 或后续 Slice 提前开发。不得改变既有产品/技术 Authority、合同、权限、业务流程或自创产品状态。

## Acceptance Scenarios

### AC-01 — Native Build (FR-001)

使用实际微信 DevTools 构建最小原生项目，编译成功且 Simulator 正常运行 Bootstrap；记录实际构建、操作与观察结果。不以普通 TypeScript 构建代替原生编译。

### AC-02 — Real Device (FR-001, FR-002)

目标真机运行真实候选构建；记录设备、系统、微信客户端、基础库及 DevTools 版本、实际环境、操作和媒体证据。Simulator 不可替代真机。

### AC-03 — Contract Types (FR-003, FR-007)

直接使用 generated types；合法方法/路径及参数通过静态检查，非法路径、方法或参数有真实类型负例约束，响应和错误类型保持生成合同语义。不得以重复 DTO/schema 或无约束断言绕过。

### AC-04 — HTTP Compatibility (FR-002, FR-003)

在目标微信 Runtime 实测冻结 openapi-fetch 方案的适用 Request/Response/Fetch、请求取消、响应读取及错误行为；记录真实平台限制。若不兼容，按 AC-08 停止正式实现，不宣称通过。

### AC-05 — Backend Integration (FR-005)

实际指定隔离测试 Backend 中，合法预置凭证请求 GET /api/v1/me 获得 200 与 MeResponse 合同响应，无凭证请求获得 401 与 UNAUTHENTICATED 合同错误。记录真实部署 SHA、合同身份及脱敏证据，不用 fixture/mock/healthz 代替。

### AC-06 — Failure and Cancellation (FR-004)

分别验证有界超时、网络失败、显式取消、HTTP 错误、请求所有者生命周期结束、失效请求晚到响应。观测失败分类、取消或失效后的响应不再更新对应状态；自动化可重复验证与适用真实平台证据结合，不能用 mock 证明平台事实。

### AC-07 — Chunked Platform Behavior (FR-006)

目标真实 Runtime 取得完整响应结束前的多次 chunk 交付、字节读取、取消/中断及适用的切后台和网络变化证据；区分实际分块与完整缓冲。若目标平台无法验证该行为，明确记录限制与未验证项，不宣称 AC-07 PASS 或生产 Streaming readiness。

### AC-08 — Authority Decision (FR-002, FR-007)

以真实证据支持 Transport 兼容性决定；不兼容时 STOP 正式 Transport 实现，按 Authority 变更流程提交 targeted request，未批准不得替换方案或将阻断报告视为实现完成。

### AC-09 — Engineering Verification (FR-001–FR-007)

完成适用 Authority/Contract Integrity 与 Freshness、Spec Governance、TypeScript、Vitest 正式应用测试及保留的治理自测、真实联调、真实设备证据和最终 Exact-head CI。所有适用未验证项或阻断缺陷须关闭后方可声明交付完成；独立 Audit 2 不由 Developer 或 Plan AI 1 替代。无产品视觉和正式业务旅程，明确标记不适用。

## Acceptance Evidence

本阶段只冻结验收义务；AC-01–AC-09 的实现、Runtime、联调、真机及应用测试均尚未执行，不得以本规划候选 CI 代替。

后续 Developer 依 specs/README.md 与 FE-DELIVERY 的正式证据规则提交适用 manual/device 记录于 tests/evidence/：type、result、reference、准确 base、candidateFiles（Change Binding 中排除 tests/evidence/ 的全部路径与 SHA-256）、design（真实 unit、selector、完整文件 SHA-256）、observedAt、environment、operations（action/expected/actual）、artifacts（真实路径与 SHA-256）、defects、unverified。device 至少一份当前候选真实适用媒体；manual 按实际适用性留证，不强造截图。证据仅使用隔离测试内容并脱敏。候选内容变化导致绑定失配时重新取证；未验证或有阻断缺陷不能标记 PASS。独立 Audit 2 绑定实际 Exact Head 并读取真实媒体、环境、操作及结果；CI 只证明适用机器检查，不代替独立判断。

Specify / Clarify：FR-001–FR-007、AC-01–AC-09 实质保持；当前需求无未决澄清，实际设备与部署结果由 Developer 验收，openapi-fetch 不兼容依 FR-007 停止并提交变更请求。此 Spec-only 候选采用 Owner 本轮授权的 GitHub-native 创建方式，遵循仓库 Spec Kit 1.2.1 模板与 sequential 命名规则；未执行 CLI，不冒充 CLI 生成结果。正式路径执行差异由 Owner 按既有治理裁决。Planning Admission 尚未完成，Developer Execution 尚未开始。
