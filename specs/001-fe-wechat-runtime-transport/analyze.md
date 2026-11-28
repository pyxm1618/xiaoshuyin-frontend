# Analyze — FE-001 — WeChat Runtime & Typed Transport Entry

## Review basis and method

Plan AI 2 independent final planning closeout & Audit 1 review on `plan/001-fe-transport-authority-reconciliation` against live remote truth:
- Frontend Main: `c1d6b2eff79b6d50ad845ce404a2d5a603c477bb` (PR #22 merged; CI run `46099080689` 6/6 PASS). This branch was rebased onto it and `authority-downstream-impact.json` `base` plus `audit1.json` `authorityImpact` are recomputed for that exact base.
- Backend Main: `47b3d16b89d8e77d3b8e1b907a3df359cd2f26e7` (latest commit closes a Consent propagation finding and Compliance lock contention; it does not touch imported Authority or generated contract files, so the freshness rules yield `CURRENT`, not a mechanical block).
- Authority source manifest `1c5b64012c0b9c5b173d67eabc3acfaae9450f6c` (9/9 blobs `CURRENT`), Contract source manifest `9a1589a88729be46eadf81279d8a1eb7628cf29b` (2/2 blobs `CURRENT`), verified via `authority:check --remote` and `contract:check --remote` against upstream main `47b3d16`.
- Plan AI 1 exact candidate files (unchanged by Plan AI 2, byte-level SHA-256 independently recomputed and verified):
  - `Docs/frontend/engineering/V1前端工程技术设计.md`: before `b5176fa3e9460f5efd30ead31fa1421518568167f0dd966e2445b1c006928a62` -> after `e1f3824acb9e5ca308fd0f403881c4ccbc0ad12731dad08458b0a2d042257184` (blob `8001da926e3d48cdbb1da57b0473efdaee3ce97c` -> `41bde47f87c99569b93c37cbd57360378adb9aca`).
  - `Docs/frontend/engineering/前后端合同与集成规范.md`: before `8b21da566808171b34e18cfa9c35933759de218a0189b2b3dfce6fb7d34687f8` -> after `512e44b5e2bb5d79864efce101098c8ac08d1fedfa0e5284966a1b5d95f967fd` (blob `2ace93f1b5e865492f8f459d7f9006270e0c6a06` -> `05cba375d85e8d57a4a8a44683d66c361a9cd5f1`).
  - `specs/001-fe-wechat-runtime-transport/spec.md`: before `3ee21155974f6d52431bd77e60d1e57c0276ce1b3ef3e52e30b200628505a599` -> after `29d1ab08e499520e2bec123e8119e5a576558e547160172309aa9235c2838d2f` (blob `4e0d6db53920a31869ebba135daadc5f07df152e` -> `0fc594b2150c0b2bc589e535bab9779660156682`).
- Original Developer Head `8c72fcf231148623c1e6e027989f32692181413b`: inspected existing app/bootstrap/probe/test/evidence files (`runtime-compatibility.json` and `transport-decision.json` BLOCKED records for `openapi-fetch 0.17.0` confirmed intact).
- Locked TypeScript Joint Compilation Verification: executed in an isolated scratch workspace with the exact locked toolchain (Node `26.13.0`, Bun `1.4.4`, TypeScript `5.9.3`, Vitest `3.2.7`, `miniprogram-api-typings@5.3.1`), combining Main `c1d6b2e` generated `openapi.d.ts`, Developer `8c72fcf2` valid native bootstrap (`app.ts`, `pages/bootstrap/index.ts`, `platform.d.ts`), and a minimal native `wx.request` probe/thin-typed-contract compilation context (replacing only the old `openapi-fetch` fixture without implementing the formal Adapter). Result under target `tsconfig.json` (`lib: ["ES2020"]`, `skipLibCheck: false`, `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `noEmit: true`, `types: []`): `tsc` exit 0 (0 diagnostics, empty log) and `vitest run contract.test.mjs` 6/6 PASS, with all 5 `@ts-expect-error` negative variants for Path, Method, Parameters, Body, Response Field confirmed individually by removing each directive and observing the intended diagnostic (TS2322 / TS2344 / TS2322 / TS2322 / TS2339). A separate official-typing diagnostic showed `wx.request` `method` union excludes `PATCH` (TS2322), recorded as a typing limitation only, not a runtime conclusion.
- PR #15 reference corrected to the actual merge commit `0a61c068dc9d0c124d00969f80b70f3b705e2ba5` (independently read from GitHub PR metadata); the previously cited `0a61c068...705e2ba5` does not exist.
- Owner approval recorded: on 2026-11-28 the Owner stated both engineering Authority revisions may be approved and closeout should return to development; `.specify/engineering-authority-approval.json` records this truthful decision plus the exact before/after SHA-256 pairs.

## Coverage and consistency

| FR | AC | Tasks | Verification |
| --- | --- | --- | --- |
| FR-001 | 01,02,09 | T003,T004,T013,T014 | Native build manual, physical device, exact CI |
| FR-002 | 02,04,08,09 | T004,T005,T006,T013,T014 | Independent native `wx.request` ordinary HTTP probe (`wx-request-compatibility.json` / `wx-transport-decision.json`) |
| FR-003 | 03,04,09 | T001,T005,T007,T014 | Positive/negative real TS compiler (`ES2020`, `skipLibCheck: false`) and Vitest, generated contract |
| FR-004 | 06,09 | T002,T008,T009,T014 | RED/GREEN lifecycle tests, actual device failure/cancel/late callback matrix |
| FR-005 | 05,09 | T010,T014 | Real isolated `GET /api/v1/me` 200/401, schema and redacted deployment evidence |
| FR-006 | 07,09 | T002,T011,T012,T014 | Isolated `enableChunked`/`onChunkReceived` probe tests and actual early byte arrivals/interruption |
| FR-007 | 03,08,09 | T001,T005,T006,T007,T014 | Native `wx.request` T005/T006 gate before T007 formal Adapter; STOP if incompatible; historical BLOCKED preserved |

7/7 FR, 9/9 AC covered; T001–T014 original IDs, sequence, and acceptance obligations preserved without reduction or orphan tasks. T005/T006 depend directly on native `wx.request` Probe and have no circular dependency on T007 formal Adapter. All 14 tasks remain `[ ]`.

## Findings and admission implications

| ID | Actual finding | Disposition |
| --- | --- | --- |
| P-01 | Implementation Ownership for all 12 Allowed Paths already registered on Main by PR #13 (`f66748b4...`). | RESOLVED_PREREQUISITE: No re-registration; Developer restricted to minimal actual subset of registered paths. |
| P-02 | Root `tsconfig.json` coverage landed in PR #14; temporary PR #16 exceptions (`DOM`, `skipLibCheck: true`) proven unnecessary for `wx.request` + `miniprogram-api-typings@5.3.1` under the locked toolchain. | CONVERGED_IN_PR: Target `tsconfig.json` (`lib: ["ES2020"]`, `skipLibCheck: false`) included in this planning PR on Main `c1d6b2e`; PR #22 `specs/README.md` sync already merged. |
| P-03 | Node governance self-tests and fail-closed Vitest (`3.2.7`) app suite entry separated and landed in PR #15 (`0a61c068dc9d0c124d00969f80b70f3b705e2ba5`). | RESOLVED_PREREQUISITE: No governance script, test framework, or CI changes needed. |
| P-04 | Real AppID/DevTools/device, isolated test backend, pre-provisioned credentials, and controlled chunk stream source remain runtime dependencies. | DEVELOPER_RUNTIME_GATE: Not verified in planning; mandatory STOP/BLOCKED if unavailable during execution. |
| P-05 | Owner exact-content approval for `FE-ENGINEERING` (`e1f3824a...`) and `FE-INTEGRATION` (`512e44b5...`) recorded in `.specify/engineering-authority-approval.json` on 2026-11-28 based on the Owner's explicit statement. | RESOLVED_ADMISSION_GATE: Exact before/after bytes already verified; approval does not substitute for exact-head CI or Owner merge. |
| P-06 | `specs/README.md` on Main had lagged PR #20 `tsconfig.json` co-delivery wording. | RESOLVED: Minimal doc-sync PR #22 merged into `main` at `c1d6b2e` (CI 6/6 PASS); branch rebased. |
| P-07 | Generated contract exposes `PATCH /api/v1/families/{id}/members/{personId}` (`updateMemberProfile`) and `PATCH /api/v1/cases/{id}/digital-use/contract/drafts/{version}` (`updatePhoneUseContractDraft`); WeChat's public `wx.request` method list does not document PATCH, so real platform support and official typing are unproven. | PLANNED_NON_BLOCKING_RISK_PROBE: minimal probe added only to T005 (server-observed method, runtime vs typed feasibility separation, PASS/FAIL/NOT VERIFIED in `wx-request-compatibility.json`); it is a downstream business-dependency check, does not gate FE-001's original acceptance, and must not be misread as a new hard gate or a circular dependency on T007. |

## Business semantics assessment

`Business Semantics: NONE` is verified from actual scope, not merely the `ENGINEERING` label. Native `wx.request` + thin typed transport adapter, diagnostic bootstrap, owner-local request lifecycle, isolated `GET /api/v1/me` contract check (with synthetic test identity), and isolated chunked byte probe introduce zero formal user journeys, domain states, roles, session epochs, authorization rules, persistent data mutations, or backend API changes. `Phase: NOT APPLICABLE` and `Step 4 Dependency: NONE` remain valid; all future business, Experience Quality Gate, and Visual Fidelity obligations remain unwaived.

## Risk, scope and evidence audit

- Scope Drift / Overdesign check: PASSED. No Session Framework, global retry, cache, generic Networking Framework, Fetch Polyfill, second DTO/schema, TDesign buildout, or FE-002 business code introduced in planning or candidate engineering rules. The PATCH risk probe is scoped to T005 as a downstream business-dependency check and does not expand FE-001 scope or create a circular dependency on the formal Adapter.
- Evidence separation: T005/T006 use dedicated paths (`wx-request-compatibility.json`, `wx-transport-decision.json`), keeping Developer Head `8c72fcf2...` `openapi-fetch` `BLOCKED` records (`runtime-compatibility.json`, `transport-decision.json`) intact and preventing historical evidence from masquerading as new-candidate PASS; the PATCH probe result lives inside the T005 device record.
- Governance & CI boundary: The recorded Owner approval matches the exact changed Authority bytes, so `scripts/governance.mjs` `Invalid frontend engineering Authority approval` is resolved for `localChanges` (`FE-ENGINEERING`, `FE-INTEGRATION`); Spec Governance, downstream impact base, Audit 1 hashes, `tsconfig.json` co-delivery and remote freshness remain subject to exact-head CI, not asserted here.

## Conclusion

Planning artifacts (`spec.md`, `plan.md`, `checklist.md`, `tasks.md`, `analyze.md`), target `tsconfig.json`, `.specify/engineering-authority-approval.json` and `.specify/authority-downstream-impact.json` are reconciled for the `wx.request` + thin typed transport adapter direction on Frontend Main `c1d6b2e`, with locked-toolchain TypeScript joint-compilation evidence removing the two temporary compiler exceptions, the PR #15 reference corrected, and a non-blocking PATCH compatibility risk probe planned in T005. Planning Review (`Audit 1`) satisfies all technical and traceability criteria. Owner Approval is recorded; Governance Admission still requires exact-head CI six checks and Owner merge. Developer Runtime Gate remains CLOSED. Stop at `READY_FOR_FINAL_BOUNDED_INDEPENDENT_REVIEW`.
