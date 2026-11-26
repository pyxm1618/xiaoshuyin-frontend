# Analyze — FE-001 — WeChat Runtime & Typed Transport Entry

## Review basis and method

Plan AI 2 cross-check of actual frozen spec (blob 8b410037180fbb4383c5ee3d5567934a429e5556), plan, checklist, tasks, authority selectors, current Git trees, source manifests, code and governance. Initial PR #12 head fc0b63a776e51344d71e6a73c11ba6037acd0893, frontend main 76e103ddd156f0210afb80f8fda54e9b4c2df5cc, backend main d043d07a5d9a3aa3766ff54a1582358fe5ad905c, merge base frontend main, ahead/behind 1/0, draft/open/mergeable, one added spec file, review threads 0. CI run 45791531687 associated with initial head, six jobs success; not proof of new planning candidate or runtime. Authority source manifest 9/9 blobs match upstream current tree; contract source 2/2 match; generated JSON fetched by blob (large Contents API returned empty), parsed getMe, types inspected; absent AI run stream/get. Backend me route and auth plugin, app registration and authz source inspected; getMe only CONTRACT-LISTED, real deployment/credential not verified.

Reviewed tracked Spec Kit 1.2.1 templates, constitution, specs/README, actual FE Engineering/Delivery/Integration authority, imported relevant technical selectors and design boundary, package/lock/tsconfig, CI, governance.mjs and governance-policy.mjs, bootstrap self-test constraints, frontend-audit1 workflow and prerequisite script. GitHub-native file authoring/read-back and existing CI, not actual setup-plan/setup-tasks/check-prerequisites shell or Spec Kit CLI/workflow execution. Formal workflow prerequisites file presence and governance can be checked remotely, but CLI execution and shell output cannot be claimed. Actual formal path difference remains disclosed for Chief/Owner disposition; no governance bypass.

## Coverage and consistency

| FR | AC | Tasks | Verification |
| --- | --- | --- | --- |
| FR-001 | 01,02,09 | T003,T004,T013,T014 | Native build manual, physical device, exact CI |
| FR-002 | 02,04,08,09 | T004,T005,T006,T013,T014 | Actual approved thin-adapter real-device matrix and gate; original openapi-fetch BLOCKED evidence retained |
| FR-003 | 03,04,09 | T001,T005,T007,T014 | Positive/negative real TS compiler and Vitest, generated contract |
| FR-004 | 06,09 | T002,T008,T009,T014 | RED/GREEN lifecycle tests, actual device failure/late response |
| FR-005 | 05,09 | T010,T014 | Real isolated GET me 200/401, schema and redacted deployment evidence |
| FR-006 | 07,09 | T002,T011,T012,T014 | Isolated probe tests and actual early byte arrivals/interruption |
| FR-007 | 03,08,09 | T001,T005,T006,T007,T014 | Runtime decision before client; Owner approval without device acceptance; STOP if incompatible |

7/7 FR, 9/9 AC planned; no orphan task: each actual REQ selector is present in frozen spec and maps to applicable requirements; VERIFY references match required test/device/manual syntax. T001–T014 unchecked. No test/real device results claimed. T001/T002 first define expected failing tests/procedures; bootstrap minimal to enable platform testing; T005 and T006 before T007, T008 lifecycle implementation follows RED; T009 actual platform, T010 actual backend, T011–T012 independent chunk, T013–T014 final refresh. No formal transport if compatibility unavailable. Type checks include negative examples; no global retry/session/DTO/framework or artificial success.

## Findings and admission implications

| ID | Actual finding | Disposition |
| --- | --- | --- |
| P-01 | Ownership registry empty; validator checks owners against registered feature and base. | Developer admission prerequisite: separate reviewed finite ownership change after planning merge; no registry edit in this PR. |
| P-02 | root tsconfig includes generated types and app TS only, strict ES2020 and types:[]; external TS negative fixture absent, platform typing decision needed. | Independent tsconfig-only PR before development; extend only real necessary scope, determine actual package declaration needs, no weakening; no absent type package reference in baseline CI. |
| P-03 | node --test 'tests/**/*.test.mjs' conflicts with required Vitest .test.mjs paths; protected script cannot mix dependency updates; current verify-all lacks Vitest. | Minimal separate governance PR isolates retained Node self-test and requires app suite in existing CI once source/tests exist, fail closed; implementation pins Vitest 3.2.7 in package/lock. No new governance system. |
| P-04 | Actual platform compatibility, existing AppID/access, test backend deployment/credentials and chunk source not verified. | Dependent Developer operations/acceptance gates, not planning blockers. Explicit STOP/no substitute. |
| P-05 | GitHub-native planning, actual Spec Kit setup/prerequisite/workflow commands not executed. | Report difference, remote candidate read-back/CI and manual audit evidence only; Chief/Owner reviews formal path before admission. |
| P-06 | Production stream/get contract absent. | DEFERRED for later dependent slice; isolated technical probe only, no backend redesign. |
| P-07 | Developer target-device evidence at head 8c72fcf231148623c1e6e027989f32692181413b: DevTools cannot emit/load the openapi-fetch 0.17.0 entry (preview package 10,458 B against a 17,662 B library, blank device page); Request/Response/Headers/Fetch semantics remain unverified and no approach is proven impossible. Owner approved `wx.request` + thin typed adapter. | Upstream Authority amended (#155 topology, #156 Authority) and synced in a separate controlled PR; T005/T006 now verify the approved adapter on the real target with a separate evidence pair; original BLOCKED evidence retained byte-identical; openapi-fetch-era tests cannot masquerade; DOM+skipLibCheck exception re-evaluated with local tsc evidence for the separate tsconfig-only PR. |

No identified requirement contradiction or scope expansion; findings above are concrete prerequisites/limitations, not falsely resolved runtime tests. No approved ownership, governance PR, actual execution or deployment implied. Current code baseline has no app implementation; no need to reopen Foundation or create business artifacts.

## Business semantics assessment

NONE is justified by actual scope, not ENGINEERING label. No new formal user workflow, domain state, role, authorization, session, family, persistence or backend mutation. Bootstrap is diagnostic only; /me is existing server-owned self-read using synthetic approved identity, no client-generated token or role decision. Probe/lifecycle only communication behavior; no UI business projection or production flow. Phase NOT APPLICABLE, Step 4 NONE. Actual frontend engineering selectors constrain scope, contract and real evidence; imported product/UX authorities are preserved. Future business and experience/visual gates not waived.

## Risk, scope and evidence audit

Allowed paths minimal and classified implementation/shared by actual governance-policy.mjs; forbidden protects Authority/contract/other scope/CI/governance/production outputs. Separate admission changes not implementation authority. Only completion boxes and required binding/evidence metadata allowed as governance exception. Tests reference actual planned paths under owned tests/fe-001/; type fixture has explicit tsconfig-only precondition. Device/manual records bound to current implementation files and actual authority hashes, no circular self-reference, actual media required for device. No false PASS, all tasks uncompleted. Engineering/Contract/Real-device applicable; formal product Experience/Visual N/A. Audit 2 remains independent exact-head after implementation. No additional abstractions, TDesign, business state or FE-002.

## Targeted transport amendment (2026-11-26)

Owner approved Plan A: the mini program moves from the frozen `openapi-fetch` runtime to `wx.request` behind a thin typed transport adapter; `openapi-typescript` and the generated TypeScript types remain the sole client contract type source; the operations console keeps `openapi-fetch`; Plan B, vendored CJS, a generic Fetch polyfill and custom bundling are not adopted. The change is a technical execution decision only — no product requirement, backend business, OpenAPI contract, generated artifact or business semantics change, and §18.4 Chunked Streaming Contract is untouched.

Cross-check performed for this amendment: the amended `Docs/V1技术设计.md` was read back at the actual backend candidate (blob `afef9fcc…` → `decc923a…`), the delta is confined to `AUTH-V1T-135` and `AUTH-V1T-211`, and the unchanged provisions (stack table, §4.1 dependency lock, `Docs/总体技术架构.md` §18/§19) remain truthful because `openapi-fetch` is still a real dependency for the operations console. The generated contract blobs `68d3b9e6…` / `84fc009c…` are unchanged. The developer's BLOCKED evidence is consistent with the Owner's framing: it records a DevTools packaging/loading failure and explicitly does not claim that all adaptation approaches are impossible.

Amendment effects: FR-002/FR-003/FR-007 and AC-04/AC-08 are reworded to the approved client and its real-device matrix; T005/T006 keep their hard-gate position and now verify the approved adapter with a new evidence pair while the original openapi-fetch BLOCKED files stay byte-identical; T007 implements the thin adapter instead of an `openapi-fetch` client; the adapter needs its own five type negatives and strict compile, so openapi-fetch-era tests cannot substitute; the DOM + `skipLibCheck` exception is re-evaluated (local `tsc` 5.9.3 with `lib:["ES2020"]` and `skipLibCheck:false` compiles the current native app, platform declarations and generated types with exit 0), and its minimal convergence is deferred to the separate tsconfig-only governance PR. Unchanged: FR/AC numbering, scope and non-goals, request lifecycle, real 200/401 integration, §18.4 chunk probe, privacy/evidence contract, business semantics NONE, and the prohibition on formal Transport before real acceptance. Owner approval is not device acceptance; nothing here is a runtime, device, integration or CI PASS claim.

## Conclusion

Planning content covers frozen scope and makes unresolved real dependencies and prerequisite governance changes explicit; no requirement changes, no implementation. Audit 1 decision is separate and binds the exact five file SHA256 values after read-back. Planning readiness is not merged planning, approved prerequisites, Developer admission, actual Runtime PASS, or final delivery. Chief/Owner review required. Stop after planning and Audit 1; PR remains draft/open.
