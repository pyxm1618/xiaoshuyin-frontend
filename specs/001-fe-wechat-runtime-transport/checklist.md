# Checklist — FE-001 — WeChat Runtime & Typed Transport Entry

## Requirements Quality

This is planning quality review, not implementation evidence. The Spec is amended by the Owner-approved targeted transport change (2026-11-26); all runtime acceptance remains NOT VERIFIED.
- [x] CHK001 Scope unambiguous: FR-001–007; ENGINEERING / NONE / NOT APPLICABLE / Step 4 NONE; no user business behavior, session, persistence, authz or UI expansion.
- [x] CHK002 Real native platform and existing AppID/name with EAD-01; no legacy migration or additional app.
- [x] CHK003 Owner-approved `wx.request` thin typed transport adapter must pass the real target-device matrix (ordinary HTTP, params/headers, success, HTTP error, network failure, cancel/abort, response reading, runtime limits) before formal transport; any missing or incompatible item => STOP and governed escalation; Owner approval is not device acceptance; the original openapi-fetch BLOCKED evidence is retained unchanged.
- [x] CHK004 Generated contract sole type source; method/path/params/body/response/errors and no duplicated DTO; actual getMe operation and auth route inspected.
- [x] CHK005 Lifecycle includes timeout/network/HTTP/cancel/owner end/late response and unknown cannot become success; race and single-settlement tests specified.
- [x] CHK006 Chunk probe isolated; multiple chunks before completion, bytes and interruption; AI stream/parser/recovery explicitly deferred.

## Scope and Dependencies

- [x] CHK007 Current main/PR/spec, actual Authority 9/9 and contract 2/2 blob freshness confirmed at initial review; source hashes and runtime source pinned.
- [x] CHK008 Exact Allowed/Forbidden Paths and no self-authorizing implementation; ownership currently empty and separate reviewed registration required after feature exists in main.
- [x] CHK009 Actual tsconfig excludes test negative fixture, types:[]/ES2020; independent tsconfig-only review is required, compiler standards retained, exact platform types verified before use.
- [x] CHK010 Existing Node glob conflicts with Vitest VERIFY .test.mjs; protected script and application CI wiring separated from implementation dependency changes. Vitest 3.2.7, existing governance tests retained, no empty-suite or silent skip on actual app.
- [x] CHK011 Admission prerequisites vs developer validation separated; actual target runtime/Backend/credential/stream are not planning PASS. Contract listed != deployed/approved. No fake substitute.
- [x] CHK012 Privacy: approved isolated synthetic data, ephemeral credential, no logs/URLs/fixture/public storage or real families.

## Acceptance Coverage

- [x] CHK013 AC-01 actual DevTools + simulator; AC-02 actual target device/build/version/media; no simulator substitution.
- [x] CHK014 AC-03 real compiler positive/negative fixture with expected diagnostics, generated type-only consumption, typed test; AC-04 real platform ordinary HTTP.
- [x] CHK015 AC-05 real 200 MeResponse and 401 UNAUTHENTICATED via formal transport, deployment SHA/contract/authorization/redaction.
- [x] CHK016 AC-06 deterministic RED/GREEN plus platform lifecycle and stale response evidence; AC-07 separate real chunk timing, bytes, interruption, background/network behavior.
- [x] CHK017 AC-08 evidence before transport; Owner approval already recorded but does not substitute for device acceptance; missing/incompatible matrix stops; AC-09 applicable machine checks, device proof, binding, exact-head CI, separate Audit 2.
- [x] CHK018 Evidence contract includes all candidate paths, base, full design hashes, operations, actual media, defects/unverified, refresh on content changes. No PASS until actual evidence.
- [x] CHK019 Engineering/contract/device applicable; formal experience/visual N/A not waiver of future quality, no Step 4 dependency. Tests first, then minimal bootstrap, real probe, only then transport, integration, chunk, final verification.
- [x] CHK020 Openapi-fetch-era tests cannot masquerade as adapter tests: the type fixture and Vitest contract tests must exercise the thin adapter with the five real negatives under strict compile; the historical BLOCKED evidence stays byte-identical and T005/T006 use a separate adapter evidence pair.
- [x] CHK021 DOM + skipLibCheck exception re-evaluated: local tsc 5.9.3 + miniprogram-api-typings 5.3.1 compiles with lib ES2020 (no DOM) and skipLibCheck:false, so the minimal convergence (remove DOM, restore full declaration checking in the separate tsconfig-only PR) is recorded; no automatic lowering or widening of type standards.
- [x] CHK022 Authority/contract preservation: generated OpenAPI JSON/d.ts blobs unchanged, no second DTO/schema, §18.4 Chunked Streaming Contract untouched, backend business and OpenAPI contract unmodified, business semantics remain NONE.

## Audit 1 Disposition

Checklist marks only planning items reviewed, not Developer completion. Open prerequisites are recorded as pre-execution or dependent acceptance gates in plan.md; no governance change in this planning PR. GitHub-native template authoring and read-back, not actual Spec Kit CLI/workflow execution. Formal execution-path difference must be disclosed to Chief/Owner; actual audit decision and SHA256 bindings belong in audit1.json if satisfied. No self-merge, implementation or Audit 2.
