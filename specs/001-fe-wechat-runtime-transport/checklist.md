# Checklist — FE-001 — WeChat Runtime & Typed Transport Entry

## Requirements Quality

This is planning quality review, not implementation evidence. Candidate Spec `29d1ab08e499520e2bec123e8119e5a576558e547160172309aa9235c2838d2f` reconciled to native `wx.request` + thin typed transport adapter; all runtime acceptance remains NOT VERIFIED.
- [x] CHK001 Scope unambiguous: FR-001–007; ENGINEERING / NONE / NOT APPLICABLE / Step 4 NONE; no user business behavior, session, persistence, authz or UI expansion.
- [x] CHK002 Real native platform and existing AppID/name (`wx746a39363f67ae95` / 小树荫助手) with EAD-01; no legacy migration or additional app.
- [x] CHK003 Native `wx.request` + thin typed transport adapter mandatory pre-implementation T005/T006 runtime decision; incompatible => STOP formal transport and targeted request; historical `openapi-fetch` BLOCKED evidence preserved unmodified.
- [x] CHK004 Generated contract (`packages/generated/openapi.d.ts` + `openapi.json`) sole type & HTTP semantics source; method/path/params/response/errors and no duplicated DTO, Fetch Polyfill, or Networking Framework; actual `getMe` operation and auth route inspected.
- [x] CHK005 Lifecycle includes timeout/network/HTTP/cancel/owner end/late success & failure response suppression and unknown cannot become success; race and single-settlement tests specified.
- [x] CHK006 Chunk probe isolated (`wx.request` `enableChunked`/`onChunkReceived`); multiple chunks before completion, bytes and interruption; AI stream/parser/recovery explicitly deferred.

## Scope and Dependencies

- [x] CHK007 Current Frontend Main `c1d6b2eff79b6d50ad845ce404a2d5a603c477bb` (PR #22 merged, CI run `46099080689` 6/6 PASS), Backend Main `47b3d16b89d8e77d3b8e1b907a3df359cd2f26e7` (latest Consent/Compliance/Problem Formulation remediation, no imported Authority or generated contract change), Authority 9/9 (`1c5b6401...`) and Contract 2/2 (`9a1589a8...`) `CURRENT` confirmed; Candidate Spec (`29d1ab08...`) & FE-ENGINEERING (`e1f3824a...`) & FE-INTEGRATION (`512e44b5...`) SHA-256 verified from exact bytes.
- [x] CHK008 Exact Allowed/Forbidden Paths aligned; `.specify/implementation-ownership.json` already registered by PR #13 (`f66748b4...`), no duplicate Ownership application required; implementation strictly bounded to minimal actual subset.
- [x] CHK009 Root `tsconfig.json` coverage (`openapi.d.ts`, `apps/miniprogram/**/*.ts`, `tests/fe-001/contract.types.ts`) already landed in PR #14; temporary PR #16 exceptions (`lib: ["DOM"]`, `skipLibCheck: true`) verified removable via isolated joint compilation under locked toolchain (Node `26.13.0`, Bun `1.4.4`, TypeScript `5.9.3`, Vitest `3.2.7`, `miniprogram-api-typings@5.3.1`) with `ES2020`, `skipLibCheck: false`, and 5/5 negative fixtures; target `tsconfig.json` revision converged in this PR on Main `c1d6b2e` (PR #22 `specs/README.md` sync already merged).
- [x] CHK010 Node governance self-tests (`tests/bootstrap.test.mjs`) and Vitest (`3.2.7`) fail-closed application test entry already separated and landed in PR #15 (`0a61c068...`); no new test platform, governance script, or CI workflow changes required; `openapi-fetch` removed from target dependency plan.
- [x] CHK011 Admission prerequisites vs Developer runtime validation separated; Owner exact approval (`.specify/engineering-authority-approval.json`) recorded for this PR, `specs/README.md` doc sync already merged, and actual target runtime/Backend/credential/stream explicitly tracked as gates, not false PASS.
- [x] CHK012 Privacy: approved isolated synthetic data, ephemeral credential, no logs/URLs/fixture/public storage or real families.
- [x] CHK020 PATCH platform-compatibility risk probe planned only inside T005 against an approved isolated technical probe endpoint, with server-observed method, runtime-vs-typed-feasibility separation and PASS/FAIL/NOT VERIFIED recorded in `wx-request-compatibility.json`; it is a downstream business-dependency risk check (affecting `updateMemberProfile` and `updatePhoneUseContractDraft`), not a new FE-001 hard gate, with no Method Override, second DTO, generic network framework or backend contract change.

## Acceptance Coverage

- [x] CHK013 AC-01 actual DevTools + simulator; AC-02 actual target device/build/version/media; no simulator substitution.
- [x] CHK014 AC-03 real compiler positive/negative fixture (`contract.types.ts`) covering Path/Method/Parameters/Body/Response Field under `lib: ["ES2020"]` and `skipLibCheck: false`, direct `paths`/`components` type-only consumption, typed tests; AC-04 real platform ordinary HTTP via native `wx.request` without circular T007 dependency.
- [x] CHK015 AC-05 real 200 `MeResponse` and 401 `UNAUTHENTICATED` via formal transport, deployment SHA/contract/authorization/redaction.
- [x] CHK016 AC-06 deterministic RED/GREEN plus platform lifecycle and stale callback evidence; AC-07 separate real chunk timing, bytes, interruption, background/network behavior.
- [x] CHK017 AC-08 new candidate T005/T006 real device evidence before formal transport (`wx-request-compatibility.json` / `wx-transport-decision.json`); incompatible stops and no unapproved alternate; historical `openapi-fetch` `runtime-compatibility.json` / `transport-decision.json` BLOCKED records preserved untouched; AC-09 applicable machine checks, device proof, binding, exact-head CI, separate Audit 2.
- [x] CHK018 Evidence contract includes independent paths for new candidate T005/T006, all candidate paths, base, full design hashes, operations, actual media, defects/unverified, refresh on content changes; prior Developer bootstrap/tests/evidence on `8c72fcf2...` accounted for without auto-passing new candidate.
- [x] CHK019 Engineering/contract/device applicable; formal experience/visual N/A not waiver of future quality, no Step 4 dependency. Tests first (`T001→T002`), then minimal bootstrap (`T003→T004`), real native `wx.request` probe (`T005→T006`), only then formal transport (`T007→T009`), integration (`T010`), chunk (`T011→T012`), final verification (`T013→T014`).

## Audit 1 Disposition

Checklist marks only planning quality review by Plan AI 2, not Owner approval or Developer completion. Prior infrastructure prerequisites (PR #13/#14/#15) are confirmed present on Main `c1d6b2e`; PR #22 (`specs/README.md` sync) is merged and this branch is rebased onto it. Owner exact-content approval (`.specify/engineering-authority-approval.json`) is recorded for this PR. Remaining governance prerequisites before Developer admission are exact-head CI six checks and Owner merge. GitHub-native template authoring and isolated locked-toolchain joint compiler verification executed; actual Audit 1 renewal decision and UTF-8 SHA-256 bindings belong in `audit1.json`. No self-merge, formal implementation, or Audit 2.
