import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  PATHS,
  SOURCE,
  githubGet as upstreamGithubGet,
  githubHeaders as upstreamGithubHeaders,
  verifySnapshot,
  verifyFreshness,
  isAdditionalAuthority,
} from '../scripts/upstream.mjs';
import {
  githubGet as rulesetGithubGet,
  githubHeaders as rulesetGithubHeaders,
} from '../scripts/check-ruleset.mjs';
import { engineeringApproval, planDigest, planningFiles } from '../scripts/governance-policy.mjs';
import { REPOSITORY, validateGovernance } from '../scripts/governance.mjs';
import { verifyApplicationTests } from '../scripts/verify-all.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const feature = '001-fe-fixture';
const folder = `specs/${feature}`;
const ownership = '.specify/implementation-ownership.json';
const testPath = 'tests/slice-fixture.test.mjs';
const applicationPath = 'apps/miniprogram/fixture.ts';
const bindingPath = '.specify/change-binding.json';
const evidencePath = '.specify/task-evidence.json';
const productAuthority = 'Docs/V1产品需求.md';
const technicalAuthority = 'Docs/V1技术设计.md';
const engineeringAuthority = 'Docs/frontend/engineering/V1前端工程技术设计.md';
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const taskLine = `T001 Exercised declaration [REQ:V1-C36] [VERIFY:test:${testPath}]`;

function fixture(t, {
  audit = true,
  shared = false,
  missingPlanArtifact,
  lifecycle = false,
  sliceKind = 'BUSINESS',
  canonicalBusinessRef = true,
  businessSelector = 'V1-C36',
  businessAuthorityUnit = 'V1-TECHNICAL',
  productAuthoritySelectors = ['U01'],
  semantics = sliceKind === 'BUSINESS' ? 'CHANGED' : 'NONE',
  verificationType = 'test',
  verificationPath = verificationType === 'test' ? testPath : `tests/evidence/${verificationType}.json`,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'xiaoshuyin-fe-governance-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => writeFileSync(join(root, path), text);
  const json = (path, object) => write(path, JSON.stringify(object));
  const read = (path) => readFileSync(join(root, path));
  for (const path of ['.specify', 'packages/generated', folder, 'apps/miniprogram', 'tests']) {
    mkdirSync(join(root, path), { recursive: true });
  }
  write('package.json', readFileSync('package.json'));
  json('tsconfig.json', {
    compilerOptions: {strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, noEmit: true, types: []},
    include: [PATHS.contract[1], 'apps/miniprogram/**/*.ts'],
  });
  write('specs/README.md', '# Synthetic planning artifacts\n');
  const importedIds = new Map([
    ['Docs/总产品需求.md', 'PRODUCT'],
    ['Docs/总体技术架构.md', 'ARCHITECTURE'],
    [productAuthority, 'V1-PRODUCT'],
    [technicalAuthority, 'V1-TECHNICAL'],
  ]);
  const authorityUnits = [
    ...PATHS.authority.map((path, i) => ({id: importedIds.get(path) ?? `FIXTURE-${i}`, path, owner: 'imported'})),
    {id: 'FE-ENGINEERING', path: engineeringAuthority, owner: 'frontend'},
    {id: 'FE-DELIVERY', path: 'Docs/frontend/engineering/V1前端开发与验收规范.md', owner: 'frontend'},
    {id: 'FE-INTEGRATION', path: 'Docs/frontend/engineering/前后端合同与集成规范.md', owner: 'frontend'},
  ];
  for (const {path} of authorityUnits) {
    mkdirSync(join(root, path, '..'), {recursive: true});
    const text = path === technicalAuthority ? '| V1-C36 | 现有微信小程序为家庭主端，不另建家庭 Web |\n### Phase 1：Common Core 地基'
      : path === productAuthority ? productAuthoritySelectors.map((selector) =>
        `${selector} synthetic canonical product selector`).join('\n')
      : path === engineeringAuthority ? '## 请求、可靠性与隐私\n空态要有服务端证据。' : '# Synthetic Authority';
    write(path, text + '\n');
  }
  json('.specify/authority-unit-registry.json', {schemaVersion: 1, units: authorityUnits});
  const fakeSource = {sourceRepository: SOURCE, sourceCommit: '1'.repeat(40)};
  const snapshotEntry = (path, classification) => ({
    sourcePath: path, destinationPath: path, sourceBlob: gitBlob(read(path)), sha256: digest(read(path)), classification,
  });
  json('.specify/authority-source.json', {...fakeSource, files: PATHS.authority.map((path) =>
    snapshotEntry(path, path.startsWith('Docs/frontend/') ? 'frontend-experience' : 'upstream-authority'))});
  json(PATHS.contract[0], {openapi: '3.1.0', info: {version: '0.0.0-fixture'}, paths: {'/fixture': {get: {}}}});
  write(PATHS.contract[1], 'export interface paths {}\n');
  json('.specify/contract-source.json', {...fakeSource, version: {openapi: '3.1.0', info: '0.0.0-fixture'},
    files: PATHS.contract.map((path) => snapshotEntry(path, 'api-contract'))});
  json(ownership, {schemaVersion: 1, repository: REPOSITORY, owners: {}});
  json('.specify/task-provenance-registry.json', {schemaVersion: 1, repository: REPOSITORY,
    mode: 'git-history-and-current-delta', evidenceFiles: [bindingPath, evidencePath]});
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=Frontend fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Governance self-test fixture');
    return git('rev-parse', 'HEAD');
  };
  const requirement = canonicalBusinessRef ? businessSelector : '请求、可靠性与隐私';
  const upstream = canonicalBusinessRef ? `[AUTH:${businessAuthorityUnit}] ${businessSelector}\n` : '';
  const activeTaskLine = `T001 Exercised declaration [REQ:${requirement}] [VERIFY:${verificationType}:${verificationPath}]`;
  const spec = `**Slice**: FE-001
**Kind**: ${sliceKind}
**Business Semantics**: ${semantics}
${semantics === 'NONE' ? '**Phase**: NOT APPLICABLE' : ''}

## Upstream Traceability
${upstream}${semantics === 'CHANGED' && canonicalBusinessRef ? '[AUTH:V1-PRODUCT] U01\n[AUTH:V1-TECHNICAL] Phase 1：Common Core 地基\n' : ''}[AUTH:FE-ENGINEERING] 请求、可靠性与隐私

## Business Semantics Assessment
Synthetic ${semantics} assessment: governance fixture only; no production claim.

## Backend and Contract Dependencies
[CONTRACT] GET /fixture

## Scope
Fixture

## Non-goals
Production

## Acceptance Scenarios
Fixture

## Acceptance Evidence
Test
`;
  const bootstrapBase = lifecycle ? commit() : undefined;
  write(`${folder}/spec.md`, spec);
  const specified = lifecycle ? commit() : undefined;
  if (lifecycle) write(`${folder}/spec.md`, spec + '\n## Clarifications\nSynthetic clarification frozen.\n');
  const frozen = lifecycle ? commit() : undefined;
  write(`${folder}/plan.md`, `## Upstream Traceability

## Constitution Check

## Scope Contract
[ALLOW] apps/miniprogram/
[ALLOW] ${verificationPath}
[ALLOW] tests/evidence/capture.png
[ALLOW] package.json

## Verification Plan

## STOP Conditions
`);
  write(`${folder}/tasks.md`, `- [ ] ${activeTaskLine}\n`);
  write(`${folder}/checklist.md`, '# Captured checklist\n');
  write(`${folder}/analyze.md`, '# Captured cross-artifact analysis\n');
  const analyzed = lifecycle ? commit() : undefined;
  if (audit) json(`${folder}/audit1.json`, { feature, role: 'Plan AI 2', decision: 'PASS', evidence: 'Synthetic audit fixture',
    semanticAssessment: {businessSemantics: semantics, rationale: 'Synthetic reviewed scope', evidence: 'Synthetic Plan AI 2 review'},
    artifacts: Object.fromEntries(planningFiles.map((name) => [name, planDigest(name, read(`${folder}/${name}`).toString())])) });
  if (missingPlanArtifact) rmSync(join(root, folder, missingPlanArtifact));
  const audited = lifecycle ? commit() : undefined;
  json(ownership, { schemaVersion: 1, repository: REPOSITORY, owners: {
    [applicationPath]: [feature], [verificationPath]: [feature], ...(verificationType !== 'test' ? {'tests/evidence/capture.png': [feature]} : {}), ...(shared && {'package.json': [feature]}) } });
  const base = commit();
  const validate = (options = {}) => validateGovernance(root, { base, repository: REPOSITORY, ...options });
  const delivery = (lawful = true, deliveryBase = base) => {
    const code = lawful ? applicationPath : 'apps/miniprogram/unauthorized.ts';
    write(code, 'export {};\n');
    mkdirSync(join(root, verificationPath, '..'), {recursive: true});
    if (verificationType === 'test') {
      write(verificationPath, 'import { test } from "node:test"; import assert from "node:assert/strict"; test("fixture", () => assert.equal(typeof 1, "number"));\n');
    } else {
      json(verificationPath, {
        type: verificationType,
        result: 'PASS',
        reference: `Synthetic ${verificationType} acceptance evidence`,
        base: deliveryBase,
        candidateFiles: {[code]: digest(read(code))},
        design: [{unit: 'FE-ENGINEERING', selector: '请求、可靠性与隐私', sha256: digest(read(engineeringAuthority))}],
        observedAt: '2026-11-26T00:00:00Z',
        environment: 'Synthetic fixture only; never real acceptance',
        operations: [{action: 'Synthetic operation', expected: 'Synthetic expectation', actual: 'Synthetic observation'}],
        artifacts: [{path: 'tests/evidence/capture.png', sha256: digest(Buffer.from('Synthetic capture fixture; not real media'))}],
        defects: [],
        unverified: [],
      });
    }
    if (verificationType !== 'test') write('tests/evidence/capture.png', 'Synthetic capture fixture; not real media');
    write(`${folder}/tasks.md`, read(`${folder}/tasks.md`).toString().replace(/^- \[ \] T001 /m, '- [x] T001 '));
    if (shared) json('package.json', {...JSON.parse(read('package.json')), description: 'Synthetic shared tooling edit'});
    const paths = [code, verificationPath, ...(verificationType !== 'test' ? ['tests/evidence/capture.png'] : []), ...(shared ? ['package.json'] : [])];
    json(bindingPath, { repository: REPOSITORY, feature, kind: shared ? 'shared-engineering' : 'implementation',
      files: Object.fromEntries(paths.map((path) => [path, digest(read(path))])) });
    json(evidencePath, { repository: REPOSITORY, feature, base: deliveryBase, binding: digest(read(bindingPath)),
      tasks: { T001: { taskDigest: digest(activeTaskLine), files: paths } } });
  };
  return { root, write, json, read, spec, activeTaskLine, verificationPath, commit, validate, delivery, base,
    bootstrapBase, specified, frozen, analyzed, audited, git };
}

test('local authority and contract match all listed blobs and versions', () => {
  const {files} = verifySnapshot(process.cwd(), 'authority', {base: process.env.GOVERNANCE_BASE || undefined});
  assert.ok(PATHS.authority.every((path) => files.some(({sourcePath}) => sourcePath === path)));
  assert.equal(verifySnapshot(process.cwd(), 'contract').files.length, 2);
});

test('a valid staged Spec and a fresh authorized implementation both pass', async (t) => {
  const f = fixture(t);
  assert.equal(await f.validate(), 1);
  f.delivery();
  f.commit();
  assert.equal(await f.validate(), 1);
});

test('a Spec must cite real Authority', async (t) => {
  const f = fixture(t);
  f.write(`${folder}/spec.md`, f.spec.replace('[AUTH:V1-TECHNICAL] V1-C36', '[AUTH:V1-TECHNICAL] missing selector'));
  f.commit();
  await assert.rejects(f.validate(), /unresolved Authority selector/);
});

test('a BUSINESS Slice requires a canonical upstream product or technical selector', async (t) => {
  const f = fixture(t, {canonicalBusinessRef: false});
  await assert.rejects(f.validate(), /business Slice requires an upstream canonical product\/technical selector/);
});

test('a BUSINESS Slice accepts canonical 010xx child selectors with A-F suffixes', async (t) => {
  const f = fixture(t, {
    businessSelector: '01002A',
    businessAuthorityUnit: 'V1-PRODUCT',
    productAuthoritySelectors: ['U01', '01002A'],
  });
  assert.equal(await f.validate(), 1);
});

test('a BUSINESS Slice rejects unsupported 010xx letter suffixes even if the text exists upstream', async (t) => {
  const f = fixture(t, {
    businessSelector: '01002G',
    businessAuthorityUnit: 'V1-PRODUCT',
    productAuthoritySelectors: ['U01', '01002G'],
  });
  f.write(`${folder}/spec.md`, f.spec.replace('[AUTH:V1-PRODUCT] U01\n', ''));
  await assert.rejects(f.validate(), /business Slice requires an upstream canonical product\/technical selector/);
});

test('an ENGINEERING Slice may rely on frontend engineering Authority without a business selector', async (t) => {
  const f = fixture(t, {sliceKind: 'ENGINEERING', canonicalBusinessRef: false});
  assert.equal(await f.validate(), 1);
});

test('device, visual and manual verification use current structured evidence instead of fake test files', async (t) => {
  for (const verificationType of ['device', 'visual', 'manual']) {
    const f = fixture(t, {verificationType});
    f.delivery();
    f.commit();
    assert.equal(await f.validate(), 1);
  }
});

test('non-test verification evidence must record an accepted result and reference', async (t) => {
  const f = fixture(t, {verificationType: 'device'});
  f.delivery();
  f.json(f.verificationPath, {type: 'device', result: 'FAIL', reference: 'Synthetic failed device check'});
  const binding = JSON.parse(f.read(bindingPath));
  binding.files[f.verificationPath] = digest(f.read(f.verificationPath));
  f.json(bindingPath, binding);
  const evidence = JSON.parse(f.read(evidencePath));
  evidence.binding = digest(f.read(bindingPath));
  f.json(evidencePath, evidence);
  f.commit();
  await assert.rejects(f.validate(), /Invalid device verification evidence/);
});

test('modified authority or manifest without matching hashes fails', async (t) => {
  const f = fixture(t);
  f.write(PATHS.authority[0], 'external replacement');
  f.commit();
  await assert.rejects(f.validate(), /Manifest content mismatch/);
});

test('the imported Authority cannot be adopted by changing just its manifest', async (t) => {
  const f = fixture(t);
  const path = PATHS.authority[0];
  const bytes = Buffer.from('unauthorized replacement');
  f.write(path, bytes);
  const manifest = JSON.parse(f.read('.specify/authority-source.json'));
  const entry = manifest.files.find(({ destinationPath }) => destinationPath === path);
  entry.sha256 = digest(bytes);
  entry.sourceBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  f.json('.specify/authority-source.json', manifest);
  f.commit();
  await assert.rejects(f.validate(), /controlled sync/);
});

test('implementation requires a previously owned path', async (t) => {
  const f = fixture(t);
  f.delivery(false);
  f.commit();
  await assert.rejects(f.validate(), /Unauthorized implementation path/);
});

test('Change Binding requires the exact file set', async (t) => {
  const f = fixture(t);
  f.delivery();
  f.json(bindingPath, { repository: REPOSITORY, feature, files: {} });
  f.commit();
  await assert.rejects(f.validate(), /Invalid Change Binding/);
});

test('new task completion requires current evidence', async (t) => {
  const f = fixture(t);
  f.delivery();
  rmSync(join(f.root, evidencePath));
  f.commit();
  await assert.rejects(f.validate(), /Missing current Change Binding or Task Evidence/);
});

test('wrong repository is rejected', async (t) => {
  const f = fixture(t);
  await assert.rejects(f.validate({ repository: 'pyxm1618/xiaoshuyin' }), /Wrong repository/);
});

test('a fabricated contract version is rejected', async (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(f.read('.specify/contract-source.json'));
  manifest.version.info = '9.9.9';
  f.json('.specify/contract-source.json', manifest);
  f.commit();
  await assert.rejects(f.validate(), /Contract version mismatch/);
});

test('an unrelated base or stale task digest cannot be reused as current evidence', async (t) => {
  const f = fixture(t);
  f.delivery();
  const evidence = JSON.parse(f.read(evidencePath));
  evidence.base = 'a'.repeat(40);
  f.json(evidencePath, evidence);
  f.commit();
  await assert.rejects(f.validate(), /different candidate\/base/);
  f.delivery();
  const changed = JSON.parse(f.read(evidencePath));
  changed.tasks.T001.taskDigest = 'a'.repeat(64);
  f.json(evidencePath, changed);
  f.commit();
  await assert.rejects(f.validate(), /historical Task Evidence/);
});

test('F01 engineering Authority edits require an exact-byte Owner approval', async (t) => {
  const f = fixture(t);
  const path = 'Docs/frontend/engineering/V1前端工程技术设计.md';
  const before = f.read(path);
  const after = Buffer.concat([before, Buffer.from('\nSynthetic change.\n')]);
  f.write(path, after);
  f.commit();
  await assert.rejects(f.validate(), /Missing frontend engineering Authority approval/);
  f.write(path, before);
  f.json(engineeringApproval, { repository: REPOSITORY, decision: 'Synthetic approved change',
    files: {[path]: {before: digest(before), after: digest(after)}} });
  const approvedBase = f.commit();
  assert.equal(await f.validate(), 1);
  f.write(path, after);
  writeImpact(f, approvedBase, [[path, gitBlob(before), gitBlob(after)]], {[specPath]: reviewedUnchanged()});
  f.commit();
  assert.equal(await f.validate({base: approvedBase}), 1);
  f.write(path, Buffer.concat([after, Buffer.from('Unapproved extra text.\n')]));
  f.commit();
  await assert.rejects(f.validate({base: approvedBase}), /Invalid frontend engineering Authority approval/);
});

test('F06 Owner approval, engineering Authority, impact, planning and Audit 1 converge in one controlled PR', async (t) => {
  const f = fixture(t);
  const before = f.read(engineeringAuthority);
  const after = Buffer.concat([before, Buffer.from('\nSynthetic approved engineering decision.\n')]);
  f.write(engineeringAuthority, after);
  f.json(engineeringApproval, { repository: REPOSITORY, decision: 'Synthetic same-PR Owner approval',
    files: {[engineeringAuthority]: {before: digest(before), after: digest(after)}} });
  f.write(`${folder}/spec.md`, Buffer.concat([f.read(`${folder}/spec.md`),
    Buffer.from('\n## Authority Revision\nSynthetic approved revision.\n')]));
  const config = JSON.parse(f.read('tsconfig.json'));
  f.json('tsconfig.json', {...config, include: [...config.include, 'packages/platform/**/*.ts']});
  const authority = [[engineeringAuthority, gitBlob(before), gitBlob(after)]];
  writeImpact(f, f.base, authority, {[specPath]: {
    disposition: 'converged', rationale: 'Approved engineering decision requires a direct Spec revision.',
    evidence: 'Synthetic same-PR impact review', changedArtifacts: [specPath],
  }});
  renewAudit(f, f.base, authority);
  f.commit();
  assert.equal(await f.validate(), 1);
});

test('F06 same-PR approval still rejects mixed implementation, tampered content and unrelated governance', async (t) => {
  const mixed = fixture(t);
  const before = mixed.read(engineeringAuthority);
  const after = Buffer.concat([before, Buffer.from('\nSynthetic approved decision.\n')]);
  mixed.write(engineeringAuthority, after);
  mixed.json(engineeringApproval, { repository: REPOSITORY, decision: 'Synthetic approval',
    files: {[engineeringAuthority]: {before: digest(before), after: digest(after)}} });
  mixed.write(applicationPath, 'export {};\n');
  mixed.commit();
  await assert.rejects(mixed.validate(), /Frontend engineering Authority requires a separate controlled change/);

  const tampered = fixture(t);
  const previous = tampered.read(engineeringAuthority);
  const next = Buffer.concat([previous, Buffer.from('\nSynthetic approved decision.\n')]);
  tampered.write(engineeringAuthority, next);
  tampered.json(engineeringApproval, { repository: REPOSITORY, decision: 'Synthetic approval',
    files: {[engineeringAuthority]: {before: digest(previous), after: '0'.repeat(64)}} });
  tampered.commit();
  await assert.rejects(tampered.validate(), /Invalid frontend engineering Authority approval/);

  const diluted = fixture(t);
  const original = diluted.read(engineeringAuthority);
  const changed = Buffer.concat([original, Buffer.from('\nSynthetic approved decision.\n')]);
  diluted.write(engineeringAuthority, changed);
  diluted.write('README.md', 'Synthetic unrelated governance edit.\n');
  diluted.json(engineeringApproval, { repository: REPOSITORY, decision: 'Synthetic approval',
    files: {[engineeringAuthority]: {before: digest(original), after: digest(changed)}} });
  diluted.commit();
  await assert.rejects(diluted.validate(), /Frontend engineering Authority requires a separate controlled change/);

  const extra = fixture(t);
  const bytes = extra.read(engineeringAuthority);
  extra.json(engineeringApproval, { repository: REPOSITORY, decision: 'Synthetic approval',
    files: {[engineeringAuthority]: {before: digest(bytes), after: '1'.repeat(64)}} });
  extra.write('README.md', 'Synthetic unrelated governance edit.\n');
  extra.commit();
  await assert.rejects(extra.validate(), /without document changes must remain its own PR/);
});

test('F02 Step 4 requires separate registry admission, source provenance, and intact existing imports', async (t) => {
  const f = fixture(t);
  const path = 'Docs/frontend/design-system/fixture.md';
  const bytes = Buffer.from('# Frozen synthetic source\n');
  mkdirSync(join(f.root, 'Docs/frontend/design-system'));
  f.write(path, bytes);
  f.commit();
  await assert.rejects(f.validate(), /Unexpected Authority/);
  rmSync(join(f.root, path));
  const registryPath = '.specify/authority-unit-registry.json';
  const registry = JSON.parse(f.read(registryPath));
  registry.units.push({id:'FE-STEP4-FIXTURE', path, owner:'imported', decision:'Synthetic approved admission'});
  f.json(registryPath, registry);
  const admittedBase = f.commit();
  assert.equal(await f.validate(), 1);
  const manifestPath = '.specify/authority-source.json';
  const manifest = JSON.parse(f.read(manifestPath));
  const previous = manifest.sourceCommit;
  const sourceBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  manifest.sourceCommit = 'a'.repeat(40);
  manifest.files.push({ sourcePath:path, destinationPath:path, sourceBlob, sha256:digest(bytes), classification:'frontend-experience' });
  f.write(path, bytes);
  f.json(manifestPath, manifest);
  f.json('.specify/sync-impact.json', { repository: REPOSITORY, snapshots: {authority: {
    previous, next:manifest.sourceCommit, files:[path], rationale:'Synthetic freeze', changedSpecArtifacts:[] } } });
  const importedHead = f.commit();
  await assert.rejects(f.validate(), /without prior admission/);
  assert.equal(await f.validate({base: admittedBase}), 1);
  let upstreamBlob = '0'.repeat(40);
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ref:'refs/heads/main', object:{type:'commit', sha:'a'.repeat(40)}});
    if (url.includes('/git/trees/') && !url.endsWith(`/${'a'.repeat(40)}?recursive=1`)) return new Response(null, {status: 404});
    if (url.includes('/git/trees/')) return Response.json({truncated:false, tree:[...manifest.files, ...JSON.parse(f.read('.specify/contract-source.json')).files].map((file) => ({
      path:file.sourcePath, type:'blob', mode:'100644', sha:file.sourcePath === path ? upstreamBlob : file.sourceBlob
    }))});
    const sourcePath = decodeURIComponent(url.split(`/${manifest.sourceCommit}/`)[1]);
    return new Response(f.read(sourcePath));
  });
  await assert.rejects(f.validate({base: admittedBase, remote:true}), /Upstream blob mismatch/);
  upstreamBlob = sourceBlob;
  assert.equal(await f.validate({base: admittedBase, remote:true}), 1);
  assert.equal(verifySnapshot(f.root, 'authority', {base: admittedBase}).files.length, PATHS.authority.length + 1);
  manifest.sourceCommit = 'c'.repeat(40);
  f.json(manifestPath, manifest);
  const impact = JSON.parse(f.read('.specify/sync-impact.json'));
  impact.snapshots.authority.next = manifest.sourceCommit;
  f.json('.specify/sync-impact.json', impact);
  f.commit();
  await assert.rejects(f.validate({base: admittedBase, remote:true}), /HTTP 404/);
  manifest.sourceCommit = 'a'.repeat(40);
  f.json(manifestPath, manifest);
  f.write(path, 'Tampered synthetic Authority');
  f.commit();
  await assert.rejects(f.validate({base: admittedBase}), /Manifest content mismatch/);
  rmSync(join(f.root, path));
  manifest.files.pop();
  f.json(manifestPath, manifest);
  f.commit();
  await assert.rejects(f.validate({base: importedHead}), /Previously imported Authority cannot be removed/);
});

test('F03 implementation requires Audit 1 in the base and all bound artifacts', async (t) => {
  const missingAudit = fixture(t, {audit:false});
  missingAudit.delivery();
  missingAudit.commit();
  await assert.rejects(missingAudit.validate(), /Missing Audit 1 base artifact/);
  const missingChecklist = fixture(t, {missingPlanArtifact:'checklist.md'});
  missingChecklist.delivery();
  missingChecklist.commit();
  await assert.rejects(missingChecklist.validate(), /Missing Audit 1 base artifact.*checklist/);
  const modifiedTask = fixture(t);
  modifiedTask.delivery();
  modifiedTask.write(`${folder}/tasks.md`, `- [x] ${taskLine.replace('Exercised', 'Changed after audit')}\n`);
  modifiedTask.commit();
  await assert.rejects(modifiedTask.validate(), /Audit 1 planning artifact mismatch/);
});

test('F04 unknown paths fail; authorized shared tooling passes with exact binding', async (t) => {
  const f = fixture(t, {shared:true});
  f.write('unclassified.config.js', 'export {};\n');
  f.commit();
  await assert.rejects(f.validate(), /unclassified change/);
  rmSync(join(f.root, 'unclassified.config.js'));
  f.delivery();
  f.commit();
  assert.equal(await f.validate(), 1);
  const binding = JSON.parse(f.read(bindingPath));
  binding.kind = 'implementation';
  f.json(bindingPath, binding);
  f.commit();
  await assert.rejects(f.validate(), /Invalid Change Binding kind/);
});

test('F04 shared tooling cannot replace the required verification entry points', async (t) => {
  const f = fixture(t, {shared:true});
  f.delivery();
  const packageFile = JSON.parse(f.read('package.json'));
  packageFile.scripts['governance:check'] = 'true';
  f.json('package.json', packageFile);
  const binding = JSON.parse(f.read(bindingPath));
  binding.files['package.json'] = digest(f.read('package.json'));
  f.json(bindingPath, binding);
  const evidence = JSON.parse(f.read(evidencePath));
  evidence.binding = digest(f.read(bindingPath));
  f.json(evidencePath, evidence);
  f.commit();
  await assert.rejects(f.validate(), /Protected verification script requires governance change/);
});

const authorityImpactPath = '.specify/authority-downstream-impact.json';
const specPath = `${folder}/spec.md`;
const auditPath = `${folder}/audit1.json`;
function writeImpact(f, base, authority, specs) {
  f.json(authorityImpactPath, {repository: REPOSITORY, base, authority, specs});
}

function reviewedUnchanged() {
  return { disposition: 'unchanged', rationale: 'Reviewed changed requirement; it does not affect this Spec obligation.',
    evidence: 'Synthetic independent assessment reference', changedArtifacts: [] };
}

function declareConvergence(f, base, authority, artifacts) {
  writeImpact(f, base, authority, {[specPath]: {
    disposition: 'converged', rationale: 'Material change requires a revised Spec, Plan and pending tasks.',
    evidence: 'Synthetic impact review reference', changedArtifacts: artifacts,
  }});
  const impactPath = '.specify/sync-impact.json';
  const sync = JSON.parse(f.read(impactPath));
  sync.snapshots.authority.changedSpecArtifacts = artifacts;
  f.json(impactPath, sync);
}

function renewAudit(f, base, authority) {
  f.json(auditPath, {
    ...JSON.parse(f.read(auditPath)),
    authorityImpact: digest(JSON.stringify({base, authority})),
    evidence: 'Synthetic renewed Audit 1 reference',
    artifacts: Object.fromEntries(planningFiles.map((name) => [name, planDigest(name, f.read(`${folder}/${name}`).toString())])),
  });
}

function addSpec(f, id, citeChangedAuthority) {
  const dir = `specs/${id}-fe-other`;
  mkdirSync(join(f.root, dir));
  const spec = f.spec.replace('FE-001', `FE-${id}`);
  f.write(dir + '/spec.md', citeChangedAuthority ? spec :
    spec.replace(/^\[AUTH:V1-TECHNICAL\].*\n/gm, '').replace('**Kind**: BUSINESS', '**Kind**: ENGINEERING').replace('**Business Semantics**: CHANGED', '**Business Semantics**: NONE\n**Phase**: NOT APPLICABLE'));
  return dir + '/spec.md';
}

function modifyAuthority(f, path = technicalAuthority) {
  const before = f.read(path);
  const body = before.toString();
  const changed = path === technicalAuthority
    ? body.replace('| 现有微信小程序为家庭主端，不另建家庭 Web |', '| 现有微信小程序为家庭主端，测试夹具要求第二客户端 |')
    : body.replace('空态要有服务端证据。', '空态必须提供已续期的服务端证据。');
  assert.notEqual(changed, body, 'Fixture must change requirement text while retaining the citation');
  const after = Buffer.from(changed);
  f.write(path, after);
  if (path === technicalAuthority) {
    const manifestPath = '.specify/authority-source.json';
    const manifest = JSON.parse(f.read(manifestPath));
    const previous = manifest.sourceCommit;
    manifest.sourceCommit = 'b'.repeat(40);
    Object.assign(manifest.files.find((file) => file.sourcePath === path), {sourceBlob: gitBlob(after), sha256: digest(after)});
    f.json(manifestPath, manifest);
    f.json('.specify/sync-impact.json', {repository: REPOSITORY, snapshots: {authority: {
      previous, next: manifest.sourceCommit, files: [path], rationale: 'Synthetic revision', changedSpecArtifacts: [],
    }}});
  }
  return [[path, gitBlob(before), gitBlob(after)]];
}

test('F05 unchanged citation title cannot hide a related Spec from the impact assessment', async (t) => {
  const f = fixture(t);
  const authority = modifyAuthority(f);
  f.json(authorityImpactPath, {repository: REPOSITORY, base: f.base, authority, specs: {}});
  f.commit();
  await assert.rejects(f.validate(), /Authority impact coverage/);
});

test('F05 requires assessment of all related baseline Specs even if one removes its citation in the candidate', async (t) => {
  const f = fixture(t);
  const second = addSpec(f, '002', true);
  const base = f.commit();
  const authority = modifyAuthority(f);
  f.write(second, f.read(second).toString().replace(
    '[AUTH:V1-TECHNICAL] V1-C36\n', '[AUTH:V1-PRODUCT] U01\n'));
  const manifest = JSON.parse(f.read('.specify/sync-impact.json'));
  manifest.snapshots.authority.changedSpecArtifacts = [second];
  f.json('.specify/sync-impact.json', manifest);
  writeImpact(f, base, authority, {[specPath]: reviewedUnchanged()});
  f.commit();
  await assert.rejects(f.validate({base}), /Authority impact coverage/);
});

test('F05 rejects an impact recorded for a different base or Authority version', async (t) => {
  const f = fixture(t);
  const authority = modifyAuthority(f);
  writeImpact(f, 'a'.repeat(40), authority, {[specPath]: reviewedUnchanged()});
  f.commit();
  await assert.rejects(f.validate(), /Authority impact version mismatch/);
  writeImpact(f, f.base, [[technicalAuthority, authority[0][1], '0'.repeat(40)]], {[specPath]: reviewedUnchanged()});
  f.commit();
  await assert.rejects(f.validate(), /Authority impact version mismatch/);
});

test('F05 unchanged Spec disposition needs a bound rationale and review evidence', async (t) => {
  const f = fixture(t);
  const authority = modifyAuthority(f);
  writeImpact(f, f.base, authority, {[specPath]: {...reviewedUnchanged(), evidence: ''}});
  f.commit();
  await assert.rejects(f.validate(), /Missing Authority impact review evidence/);
  writeImpact(f, f.base, authority, {[specPath]: reviewedUnchanged()});
  f.commit();
  assert.equal(await f.validate(), 1);
});

test('F05 convergence rejects stale Audit 1 and accepts renewed evidence while preserving history', async (t) => {
  const f = fixture(t);
  f.delivery();
  const historicalBase = f.commit();
  const oldEvidence = f.read(evidencePath);
  const oldBinding = f.read(bindingPath);
  const oldAudit = f.read(auditPath);
  const oldTasks = f.read(`${folder}/tasks.md`);
  const unrelated = addSpec(f, '002', false);
  const unrelatedBefore = f.read(unrelated);
  const base = f.commit();
  const authority = modifyAuthority(f);
  const artifacts = [specPath, `${folder}/plan.md`, `${folder}/tasks.md`];
  for (const path of artifacts.slice(0, 2)) f.write(path, Buffer.concat([f.read(path), Buffer.from('\nConverged requirement.\n')]));
  f.write(artifacts[2], Buffer.concat([oldTasks, Buffer.from(`- [ ] T002 Reassess requirement [REQ:V1-C36] [VERIFY:${testPath}]\n`)]));
  declareConvergence(f, base, authority, artifacts);
  f.commit();
  await assert.rejects(f.validate({base}), /Audit 1 must be renewed/);
  renewAudit(f, historicalBase, authority);
  f.commit();
  await assert.rejects(f.validate({base}), /Audit 1 must be renewed/);
  renewAudit(f, base, authority);
  f.commit();
  assert.equal(await f.validate({base}), 2);
  assert.deepEqual(f.read(unrelated), unrelatedBefore);
  assert.deepEqual(f.read(evidencePath), oldEvidence);
  assert.deepEqual(f.read(bindingPath), oldBinding);
  assert.ok(f.read(artifacts[2]).subarray(0, oldTasks.length).equals(oldTasks));
  assert.equal(execFileSync('git', ['show', `${historicalBase}:${auditPath}`], {cwd: f.root}).compare(oldAudit), 0);
});

test('F05 applies downstream coverage to an otherwise approved engineering Authority edit', async (t) => {
  const f = fixture(t);
  const path = 'Docs/frontend/engineering/V1前端工程技术设计.md';
  const authority = modifyAuthority(f, path);
  const after = f.read(path);
  const before = execFileSync('git', ['show', `${f.base}:${path}`], {cwd: f.root});
  f.write(path, before);
  f.json(engineeringApproval, {repository: REPOSITORY, decision: 'Synthetic engineering approval',
    files: {[path]: {before: digest(before), after: digest(after)}}});
  const base = f.commit();
  f.write(path, after);
  f.commit();
  await assert.rejects(f.validate({base}), /Authority impact coverage/);
  writeImpact(f, base, authority, {[specPath]: reviewedUnchanged()});
  f.commit();
  assert.equal(await f.validate({base}), 1);
});

test('F05 accepts an Authority sync without assessment when no baseline Spec depends on it', async (t) => {
  const f = fixture(t, {sliceKind:'ENGINEERING', canonicalBusinessRef:false});
  const base = f.base;
  modifyAuthority(f);
  f.commit();
  assert.equal(await f.validate({base}), 1);
});

test('FE-B4-F01 synthetic planning, admission, delivery and subsequent slices preserve history', async (t) => {
  const f = fixture(t, {lifecycle: true});
  assert.equal(await f.validate({base: f.audited}), 1);
  for (const [candidate, base, count] of [
    [f.bootstrapBase, f.bootstrapBase, 0],
    [f.specified, f.bootstrapBase, 1],
    [f.frozen, f.specified, 1],
    [f.analyzed, f.frozen, 1],
    [f.audited, f.analyzed, 1],
  ]) {
    f.git('checkout', '--detach', candidate);
    assert.equal(await f.validate({base}), count);
  }
  f.git('checkout', '--detach', f.base);
  mkdirSync(join(f.root, 'apps/miniprogram'), {recursive: true});
  mkdirSync(join(f.root, 'tests'), {recursive: true});
  f.delivery(false);
  f.commit();
  await assert.rejects(f.validate(), /Unauthorized implementation path/);
  f.git('checkout', '--detach', f.base);
  mkdirSync(join(f.root, 'apps/miniprogram'), {recursive: true});
  mkdirSync(join(f.root, 'tests'), {recursive: true});
  f.delivery();
  const historical = f.commit();
  assert.equal(await f.validate(), 1);
  addSpec(f, '002', true);
  f.commit();
  assert.equal(await f.validate({base: historical}), 2);
  assert.deepEqual(f.read(evidencePath), Buffer.from(f.git('show', `${historical}:${evidencePath}`)));
  addSpec(f, '001', true);
  f.commit();
  await assert.rejects(f.validate({base: historical}), /Duplicate slice ID FE-001/);
});

test('FE-B4-F03 the locked compiler detects type errors and governance protects the root config', async (t) => {
  const f = fixture(t, {shared: true});
  const compiler = join(process.cwd(), 'node_modules/typescript/bin/tsc');
  const tsc = (...args) => spawnSync(process.execPath, [compiler, ...args], {cwd: f.root, encoding: 'utf8'});
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(tsc('--version').stdout.trim(), `Version ${manifest.devDependencies.typescript}`);
  const checkTypes = () => tsc('--project', 'tsconfig.json', '--noEmit');
  const config = JSON.parse(f.read('tsconfig.json'));
  f.delivery();
  assert.equal(checkTypes().status, 0);
  f.write(applicationPath, 'export const count: number = "error";\n');
  const result = checkTypes();
  assert.equal(result.status, 2);
  assert.match(result.stdout, /fixture\.ts.*TS2322/);
  for (const edit of [
    {include: ['packages/generated/openapi.d.ts']},
    {exclude: ['apps/miniprogram/**']},
    {include: [], files: ['packages/generated/openapi.d.ts']},
    {compilerOptions: {...config.compilerOptions, strict: false, exactOptionalPropertyTypes: false}},
    {compilerOptions: {...config.compilerOptions, noUncheckedIndexedAccess: false, noEmit: false}},
  ]) {
    f.json('tsconfig.json', {...config, ...edit});
    f.commit();
    await assert.rejects(f.validate(), /tsconfig\.json may only accompany directly related engineering Authority and planning changes/);
  }
  f.json('tsconfig.json', {extends: './apps/miniprogram/other.json'});
  f.commit();
  await assert.rejects(f.validate(), /self-contained/);
  f.json('tsconfig.json', {references: [{path: './apps/miniprogram'}]});
  f.commit();
  await assert.rejects(f.validate(), /self-contained/);
  rmSync(join(f.root, 'tsconfig.json'));
  f.json('apps/miniprogram/delegated.json', config);
  symlinkSync('apps/miniprogram/delegated.json', join(f.root, 'tsconfig.json'));
  f.commit();
  await assert.rejects(f.validate(), /must be a regular file/);
  f.git('checkout', '--detach', f.base);
  f.json('tsconfig.json', {...config, include: [...config.include, 'packages/platform/**/*.ts']});
  const configBase = f.commit();
  assert.equal(await f.validate(), 1);
  assert.equal(checkTypes().status, 0);
  mkdirSync(join(f.root, 'packages/platform'));
  f.write('packages/platform/fixture.ts', 'export const count: number = "error";\n');
  assert.equal(checkTypes().status, 2, 'A newly admitted source directory is checked');
  rmSync(join(f.root, 'packages/platform/fixture.ts'));
  mkdirSync(join(f.root, 'apps/miniprogram'), {recursive: true});
  mkdirSync(join(f.root, 'tests'), {recursive: true});
  f.delivery(true, configBase);
  f.write('apps/miniprogram/tsconfig.json', '{}');
  f.write(applicationPath, 'export const count: number = "error";\n');
  assert.equal(checkTypes().status, 2, 'An application-local config does not replace the root project');
  rmSync(join(f.root, 'apps/miniprogram/tsconfig.json'));
  f.delivery(true, configBase);
  f.commit();
  assert.equal(await f.validate({base: configBase}), 1);
  assert.equal(checkTypes().status, 0);
});


test('F07 tsconfig.json may ship with related planning, but not implementation or unrelated governance', async (t) => {
  const planning = fixture(t);
  planning.write(`${folder}/plan.md`, Buffer.concat([planning.read(`${folder}/plan.md`),
    Buffer.from('\n[ALLOW] tests/related.test.mjs\n')]));
  planning.json('tsconfig.json', {...JSON.parse(planning.read('tsconfig.json')),
    include: ['packages/generated/openapi.d.ts', 'apps/miniprogram/**/*.ts', 'packages/platform/**/*.ts']});
  planning.commit();
  assert.equal(await planning.validate(), 1);

  const implementation = fixture(t);
  implementation.json('tsconfig.json', {...JSON.parse(implementation.read('tsconfig.json')),
    include: ['packages/generated/openapi.d.ts', 'apps/miniprogram/**/*.ts', 'packages/platform/**/*.ts']});
  implementation.write(applicationPath, 'export {};\n');
  implementation.commit();
  await assert.rejects(implementation.validate(), /tsconfig\.json may only accompany/);

  const unrelated = fixture(t);
  unrelated.json('tsconfig.json', {...JSON.parse(unrelated.read('tsconfig.json')),
    include: ['packages/generated/openapi.d.ts', 'apps/miniprogram/**/*.ts', 'packages/platform/**/*.ts']});
  unrelated.write('README.md', 'Synthetic unrelated governance edit.\n');
  unrelated.commit();
  await assert.rejects(unrelated.validate(), /tsconfig\.json may only accompany/);
});

test('GitHub API helpers use optional authentication without leaking tokens', async () => {
  const token = 'synthetic-ci-token';
  const apiUrl = 'https://api.github.com/repos/pyxm1618/xiaoshuyin';
  const rawUrl = 'https://raw.githubusercontent.com/pyxm1618/xiaoshuyin/fixture/file';

  const anonymousUpstream = upstreamGithubHeaders(apiUrl, '');
  assert.equal(anonymousUpstream.Authorization, undefined);
  assert.equal(anonymousUpstream.Accept, 'application/vnd.github+json');
  assert.equal(anonymousUpstream['User-Agent'], 'xiaoshuyin-frontend-governance');

  const authenticatedUpstream = upstreamGithubHeaders(apiUrl, token);
  assert.equal(authenticatedUpstream.Authorization, `Bearer ${token}`);
  assert.equal(upstreamGithubHeaders(rawUrl, token).Authorization, undefined);

  const anonymousRuleset = rulesetGithubHeaders('');
  assert.equal(anonymousRuleset.Authorization, undefined);
  assert.equal(anonymousRuleset.Accept, 'application/vnd.github+json');
  assert.equal(anonymousRuleset['User-Agent'], 'xiaoshuyin-frontend-governance');
  assert.equal(rulesetGithubHeaders(token).Authorization, `Bearer ${token}`);

  let upstreamOptions;
  await upstreamGithubGet(apiUrl, {
    token: '',
    timeout: 1000,
    fetchImpl: async (_url, options) => {
      upstreamOptions = options;
      return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}});
    },
  });
  assert.equal(upstreamOptions.headers.Authorization, undefined);

  let rulesetOptions;
  await rulesetGithubGet('/rulesets', {
    token,
    timeout: 1000,
    fetchImpl: async (_url, options) => {
      rulesetOptions = options;
      return new Response('[]', {status: 200, headers: {'Content-Type': 'application/json'}});
    },
  });
  assert.equal(rulesetOptions.headers.Authorization, `Bearer ${token}`);

  const forbidden = async () => new Response(null, {status: 403});
  await assert.rejects(
    upstreamGithubGet(apiUrl, {token, fetchImpl: forbidden, timeout: 1000}),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(token));
      return true;
    },
  );
  await assert.rejects(
    rulesetGithubGet('/rulesets', {token, fetchImpl: forbidden, timeout: 1000}),
    (error) => {
      assert.doesNotMatch(error.message, new RegExp(token));
      return true;
    },
  );
});


test('hardening ENGINEERING relabel cannot remove changed-business traceability', async (t) => {
  const f = fixture(t, {sliceKind: 'ENGINEERING', semantics: 'CHANGED', canonicalBusinessRef: false});
  await assert.rejects(f.validate(), /canonical product\/technical selector/);
});

test('hardening business semantics cannot be omitted or contradicted', async (t) => {
  for (const replacement of ['', '**Business Semantics**: NONE']) {
    const f = fixture(t);
    f.write(`${folder}/spec.md`, f.spec.replace('**Business Semantics**: CHANGED', replacement));
    await assert.rejects(f.validate(), /Business Semantics/);
  }
});

test('hardening changed semantics require product, Phase and real contract capability', async (t) => {
  for (const [before, after, error] of [
    ['[AUTH:V1-PRODUCT] U01\n', '', /canonical product requirement/],
    ['[AUTH:V1-TECHNICAL] Phase 1：Common Core 地基\n', '', /Phase 1–6/],
    ['[CONTRACT] GET /fixture', '[CONTRACT] POST /invented', /contract capability/],
  ]) {
    const f = fixture(t);
    f.write(`${folder}/spec.md`, f.spec.replace(before, after));
    await assert.rejects(f.validate(), error);
  }
  const gap = fixture(t);
  gap.write(`${folder}/spec.md`, gap.spec.replace('[CONTRACT] GET /fixture', '[CONTRACT] GAP: unavailable backend; implementation BLOCKED'));
  assert.equal(await gap.validate(), 1, 'A documented gap permits planning, never claims backend readiness');
});

test('hardening Audit 1 must assess the declared business semantics', async (t) => {
  const f = fixture(t, {sliceKind: 'ENGINEERING', canonicalBusinessRef: false});
  const record = JSON.parse(f.read(`${folder}/audit1.json`));
  delete record.semanticAssessment;
  f.json(`${folder}/audit1.json`, record);
  const base = f.commit();
  f.delivery(true, base); f.commit();
  await assert.rejects(f.validate({base}), /Audit 1 semantic assessment/);
});

test('hardening acceptance rejects empty PASS and stale candidate, design, artifact or observation', async (t) => {
  for (const edit of [
    (v) => ({type: v.type, result: 'PASS', reference: 'empty PASS'}),
    (v) => ({...v, candidateFiles: {[applicationPath]: '0'.repeat(64)}}),
    (v) => ({...v, design: [{...v.design[0], sha256: '0'.repeat(64)}]}),
    (v) => ({...v, artifacts: [{...v.artifacts[0], sha256: '0'.repeat(64)}]}),
    (v) => ({...v, operations: []}),
    (v) => ({...v, unverified: ['true device still unavailable']}),
    (v) => ({...v, defects: [{description:'blocking observation', blocking: true}]}),
  ]) {
    const f = fixture(t, {verificationType:'visual'});
    f.delivery();
    f.json(f.verificationPath, edit(JSON.parse(f.read(f.verificationPath))));
    const binding = JSON.parse(f.read(bindingPath));
    binding.files[f.verificationPath] = digest(f.read(f.verificationPath));
    f.json(bindingPath, binding);
    const evidence = JSON.parse(f.read(evidencePath));
    evidence.binding = digest(f.read(bindingPath));
    f.json(evidencePath, evidence); f.commit();
    await assert.rejects(f.validate(), /acceptance evidence/);
  }
});

// Add verifyFreshness and isAdditionalAuthority to upstream imports in bootstrap.test.mjs.
test('freshness compares relevant blobs at a resolved real main instead of requiring equal commits', async () => {
  const sourceCommit = '1'.repeat(40);
  const main = '2'.repeat(40);
  const sourcePath = 'packages/generated/openapi.json';
  const declarationsPath = 'packages/generated/openapi.d.ts';
  const sourceBlob = '3'.repeat(40);
  const declarationsBlob = '6'.repeat(40);
  const manifest = {sourceRepository: SOURCE, sourceCommit, files: [
    {sourcePath, sourceBlob},
    {sourcePath: declarationsPath, sourceBlob: declarationsBlob},
  ]};
  let changed = false;
  let missing = false;
  let mode = '100644';
  let truncated = false;
  let invalidMain = false;
  const get = async (url) => {
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ref:'refs/heads/main', object: {type:'commit', sha:invalidMain ? 'main' : main}});
    assert.ok(url.endsWith(`/git/trees/${main}?recursive=1`));
    return Response.json({truncated, tree: missing ? [] : [
      {path:sourcePath, type:'blob', mode, sha:changed ? '4'.repeat(40) : sourceBlob},
      {path:declarationsPath, type:'blob', mode:'100644', sha:declarationsBlob},
      {path:'apps/server/unrelated.ts', type:'blob', mode:'100644', sha:'5'.repeat(40)},
    ]});
  };
  assert.deepEqual(await verifyFreshness(manifest, 'contract', {get}), {kind:'contract', sourceCommit, main, status:'CURRENT', files:2});
  changed = true;
  await assert.rejects(verifyFreshness(manifest, 'contract', {get}), /STALE contract.*impact assessment and controlled sync required/);
  changed = false;
  missing = true;
  await assert.rejects(verifyFreshness(manifest, 'contract', {get}), /STALE contract/);
  missing = false;
  mode = '120000';
  await assert.rejects(verifyFreshness(manifest, 'contract', {get}), /STALE contract/);
  mode = '100644';
  truncated = true;
  await assert.rejects(verifyFreshness(manifest, 'contract', {get}), /tree is incomplete/);
  truncated = false;
  invalidMain = true;
  await assert.rejects(verifyFreshness(manifest, 'contract', {get}), /Invalid upstream main reference/);
  await assert.rejects(verifyFreshness(manifest, 'contract', {get:async () => {throw new Error('network failed');}}), /network failed/);
});

test('freshness blocks cited Authority drift and notices uncited drift', async () => {
  const sourceCommit = '1'.repeat(40);
  const main = '2'.repeat(40);
  const cited = 'Docs/V1技术设计.md';
  const unrelated = 'Docs/总产品需求.md';
  const manifest = {sourceRepository: SOURCE, sourceCommit, files: [
    {sourcePath: cited, sourceBlob: '3'.repeat(40)},
    {sourcePath: unrelated, sourceBlob: '4'.repeat(40)},
  ]};
  let tree = manifest.files.map(({sourcePath, sourceBlob}) =>
    ({path: sourcePath, type: 'blob', mode: '100644', sha: sourceBlob}));
  const get = async (url) => {
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ref: 'refs/heads/main', object: {type: 'commit', sha: main}});
    return Response.json({truncated: false, tree});
  };
  const dependencies = {authorityUnits: new Set([cited]), operations: new Set()};
  tree = tree.map((entry) => entry.path === unrelated ? {...entry, sha: '5'.repeat(40)} : entry);
  const result = await verifyFreshness(manifest, 'authority', {get, dependencies});
  assert.equal(result.status, 'CURRENT_WITH_UNRELATED_DRIFT');
  assert.deepEqual(result.unrelated, [unrelated]);
  tree = tree.map((entry) => entry.path === cited ? {...entry, sha: '6'.repeat(40)} : entry);
  await assert.rejects(verifyFreshness(manifest, 'authority', {get, dependencies}),
    /STALE authority.*V1技术设计\.md.*controlled sync required/);
  await assert.rejects(verifyFreshness(manifest, 'authority',
    {get, dependencies: {authorityUnits: new Set(), operations: new Set()}}),
  /no governed Spec cites an imported Authority/);
});

const baseContractDocument = () => structuredClone({
  openapi: '3.1.0', info: {version: '0.1.0-plan'},
  servers: [{url: 'https://api.example'}],
  security: [{bearerAuth: []}],
  paths: {
    '/api/v1/me': {get: {operationId: 'getMe', responses: {
      '200': {content: {'application/json': {schema: {$ref: '#/components/schemas/MeResponse'}}}},
      '401': {content: {'application/json': {schema: {$ref: '#/components/schemas/Error'}}}},
    }}},
    '/api/v1/other': {get: {operationId: 'getOther', responses: {'200': {description: 'ok'}}}},
  },
  components: {
    securitySchemes: {bearerAuth: {type: 'http', scheme: 'bearer'}},
    schemas: {
      MeResponse: {type: 'object', properties: {
        id: {type: 'string'},
        profile: {$ref: '#/components/schemas/MeProfile'},
      }},
      MeProfile: {type: 'object', properties: {
        settings: {$ref: '#/components/schemas/MeSettings'},
      }},
      MeSettings: {type: 'object', properties: {theme: {type: 'string'}}},
      Error: {type: 'object', properties: {code: {type: 'string'}}},
    },
  },
});

function contractFreshnessFixture(t, upstreamDocument, {
  declarationsChanged = false, corrupt = false, corruptDeclarations = false,
  omitDeclarations = false, declarationsMode = '100644', pinnedDocument = baseContractDocument(),
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'xsy-freshness-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'packages/generated'), { recursive: true });
  const pinnedBytes = Buffer.from(typeof pinnedDocument === 'string'
    ? pinnedDocument : JSON.stringify(pinnedDocument, null, 2));
  const pinnedDeclarations = Buffer.from('export interface paths {}\n');
  writeFileSync(join(root, 'packages/generated/openapi.json'), pinnedBytes);
  writeFileSync(join(root, 'packages/generated/openapi.d.ts'), pinnedDeclarations);
  const document = Buffer.from(typeof upstreamDocument === 'string'
    ? upstreamDocument : JSON.stringify(upstreamDocument, null, 2));
  const declarations = Buffer.from(declarationsChanged
    ? 'export interface paths { fixture: true }\n' : pinnedDeclarations);
  const main = '2'.repeat(40);
  const tree = [
    {path: 'packages/generated/openapi.json', type: 'blob', mode: '100644', sha: gitBlob(document)},
  ];
  if (!omitDeclarations) {
    tree.push({path: 'packages/generated/openapi.d.ts', type: 'blob', mode: declarationsMode, sha: gitBlob(declarations)});
  }
  const manifest = {sourceRepository: SOURCE, sourceCommit: '1'.repeat(40), files: [
    {sourcePath: 'packages/generated/openapi.json', sourceBlob: gitBlob(pinnedBytes)},
    {sourcePath: 'packages/generated/openapi.d.ts', sourceBlob: gitBlob(pinnedDeclarations)},
  ]};
  const get = async (url) => {
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ref: 'refs/heads/main', object: {type: 'commit', sha: main}});
    if (url.includes('/git/trees/')) return Response.json({truncated: false, tree});
    if (url.endsWith('/packages/generated/openapi.json')) return new Response(corrupt ? Buffer.from('tampered') : document);
    if (url.endsWith('/packages/generated/openapi.d.ts')) {
      return new Response(corruptDeclarations ? Buffer.from('tampered') : declarations);
    }
    throw new Error(`Unexpected freshness URL: ${url}`);
  };
  const dependencies = {authorityUnits: new Set(), operations: new Set(['GET /api/v1/me'])};
  return {root, main, manifest, get, dependencies};
}

test('freshness classifies contract drift across referenced schemas, auth, errors and protocol', async (t) => {
  const doc = baseContractDocument();
  doc.info.version = '0.1.1-plan';
  doc.paths['/api/v1/other'].get.responses['200'].description = 'changed';
  doc.components.schemas.Unrelated = {type: 'string'};
  const unrelated = contractFreshnessFixture(t, doc);
  const result = await verifyFreshness(unrelated.manifest, 'contract',
    {get: unrelated.get, root: unrelated.root, dependencies: unrelated.dependencies});
  assert.equal(result.status, 'CURRENT_WITH_UNRELATED_DRIFT');
  assert.deepEqual(result.unrelated, ['packages/generated/openapi.json']);

  const mutations = [
    (next) => { next.components.schemas.MeResponse.properties.id.type = 'number'; },
    (next) => { next.components.schemas.MeProfile.properties.settings.type = 'object'; },
    (next) => { next.components.schemas.MeSettings.properties.theme.type = 'number'; },
    (next) => { next.components.securitySchemes.bearerAuth.scheme = 'basic'; },
    (next) => { next.components.schemas.Error.properties.code.type = 'number'; },
    (next) => { next.servers = [{url: 'https://api.changed'}]; },
    (next) => { delete next.paths['/api/v1/me']; },
    (next) => { next.paths['/api/v1/me'].get.responses['200'].content['application/json'].schema.$ref = 'other.json#/Schema'; },
  ];
  for (const mutate of mutations) {
    const next = baseContractDocument();
    mutate(next);
    const f = contractFreshnessFixture(t, next);
    await assert.rejects(verifyFreshness(f.manifest, 'contract',
      {get: f.get, root: f.root, dependencies: f.dependencies}),
    /STALE contract.*impact assessment and controlled sync required/);
  }
});

test('freshness blocks transitive component drift and unresolved indirect references', async (t) => {
  const mutations = [
    (next) => { next.components.schemas.MeProfile.properties.settings.description = 'changed'; },
    (next) => { next.components.schemas.MeSettings.properties.theme.enum = ['light', 'dark']; },
    (next) => { delete next.components.schemas.MeSettings; },
  ];
  for (const mutate of mutations) {
    const next = baseContractDocument();
    mutate(next);
    const f = contractFreshnessFixture(t, next);
    await assert.rejects(verifyFreshness(f.manifest, 'contract',
      {get: f.get, root: f.root, dependencies: f.dependencies}),
    /STALE contract.*impact assessment and controlled sync required/);
  }

  const pinned = baseContractDocument();
  pinned.components.schemas.MeProfile.properties.settings = {$ref: '#/components/schemas/Missing'};
  const upstream = structuredClone(pinned);
  upstream.info.version = '0.1.1-plan';
  const missing = contractFreshnessFixture(t, upstream, {pinnedDocument: pinned});
  await assert.rejects(verifyFreshness(missing.manifest, 'contract',
    {get: missing.get, root: missing.root, dependencies: missing.dependencies}),
  /cannot reliably determine relevance.*unresolvable component reference/);
});

test('generated declarations drift is never classified as unrelated', async (t) => {
  const unrelatedDocument = () => {
    const doc = baseContractDocument();
    doc.info.version = '0.1.1-plan';
    doc.paths['/api/v1/other'].get.responses['200'].description = 'changed';
    return doc;
  };
  for (const [upstreamDocument, declarationsChanged] of [
    [baseContractDocument(), true],
    [unrelatedDocument(), true],
  ]) {
    const f = contractFreshnessFixture(t, upstreamDocument, {declarationsChanged});
    await assert.rejects(verifyFreshness(f.manifest, 'contract',
      {get: f.get, root: f.root, dependencies: f.dependencies}),
    /cannot reliably determine relevance.*generated declarations changed/);
  }

  for (const options of [{omitDeclarations: true}, {declarationsMode: '120000'}]) {
    const f = contractFreshnessFixture(t, unrelatedDocument(), options);
    await assert.rejects(verifyFreshness(f.manifest, 'contract',
      {get: f.get, root: f.root, dependencies: f.dependencies}),
    /STALE contract.*openapi\.d\.ts/);
  }

  const tampered = contractFreshnessFixture(t, unrelatedDocument(),
    {declarationsChanged: true, corruptDeclarations: true});
  await assert.rejects(verifyFreshness(tampered.manifest, 'contract',
    {get: tampered.get, root: tampered.root, dependencies: tampered.dependencies}),
  /INTEGRITY: upstream blob mismatch: packages\/generated\/openapi\.d\.ts/);

  const base = contractFreshnessFixture(t, unrelatedDocument());
  for (const files of [
    [base.manifest.files[0]],
    [base.manifest.files[0], base.manifest.files[0]],
    [...base.manifest.files, {sourcePath: 'packages/generated/other.json', sourceBlob: '4'.repeat(40)}],
  ]) {
    await assert.rejects(verifyFreshness({...base.manifest, files}, 'contract',
      {get: base.get, root: base.root, dependencies: base.dependencies}),
    /Invalid contract freshness manifest entries/);
  }

  writeFileSync(join(base.root, 'packages/generated/openapi.json'), 'tampered');
  await assert.rejects(verifyFreshness(base.manifest, 'contract',
    {get: base.get, root: base.root, dependencies: base.dependencies}),
  /INTEGRITY: local pinned blob mismatch: packages\/generated\/openapi\.json/);
  writeFileSync(join(base.root, 'packages/generated/openapi.json'), JSON.stringify(baseContractDocument(), null, 2));
  rmSync(join(base.root, 'packages/generated/openapi.d.ts'));
  await assert.rejects(verifyFreshness(base.manifest, 'contract',
    {get: base.get, root: base.root, dependencies: base.dependencies}),
  /INTEGRITY: local pinned contract missing: packages\/generated\/openapi\.d\.ts/);
});

test('freshness fails closed when relevance cannot be established', async (t) => {
  const versioned = () => {
    const doc = baseContractDocument();
    doc.info.version = '0.1.1-plan';
    return doc;
  };
  const noOperations = contractFreshnessFixture(t, versioned());
  await assert.rejects(verifyFreshness(noOperations.manifest, 'contract',
    {get: noOperations.get, root: noOperations.root, dependencies: {authorityUnits: new Set(), operations: new Set()}}),
  /cannot reliably determine relevance/);

  const declarationsOnly = contractFreshnessFixture(t, baseContractDocument(), {declarationsChanged: true});
  await assert.rejects(verifyFreshness(declarationsOnly.manifest, 'contract',
    {get: declarationsOnly.get, root: declarationsOnly.root, dependencies: declarationsOnly.dependencies}),
  /cannot reliably determine relevance.*generated declarations changed/);

  const malformed = contractFreshnessFixture(t, 'not an OpenAPI document');
  await assert.rejects(verifyFreshness(malformed.manifest, 'contract',
    {get: malformed.get, root: malformed.root, dependencies: malformed.dependencies}),
  /cannot reliably determine relevance/);

  const tampered = contractFreshnessFixture(t, versioned(), {corrupt: true});
  await assert.rejects(verifyFreshness(tampered.manifest, 'contract',
    {get: tampered.get, root: tampered.root, dependencies: tampered.dependencies}),
  /INTEGRITY: upstream blob mismatch/);
});

test('Step 4 path admission follows upstream design-system and screens without reopening Step 3', () => {
  assert.equal(isAdditionalAuthority('Docs/frontend/design-system/fixture.md'), true);
  assert.equal(isAdditionalAuthority('Docs/frontend/screens/fixture.md'), true);
  assert.equal(isAdditionalAuthority('Docs/frontend/screens/V1页面与屏幕架构.md'), false);
  assert.equal(isAdditionalAuthority('Docs/frontend/step-4/fixture.md'), false);
  assert.equal(isAdditionalAuthority('Docs/frontend/screens/../fixture.md'), false);
});


test('hardening a declared contract gap blocks implementation even with authorized paths', async (t) => {
  const f = fixture(t);
  f.write(`${folder}/spec.md`, f.spec.replace('[CONTRACT] GET /fixture', '[CONTRACT] GAP: required server contract absent; BLOCKED'));
  renewAudit(f, f.base, []);
  const base = f.commit();
  f.delivery(true, base); f.commit();
  await assert.rejects(f.validate({base}), /Contract gap blocks implementation/);
});

// Synthetic guard fixtures only: actual Vitest runs begin with admitted application dependencies.
test('application verification is not applicable only on the empty bootstrap', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'fe-app-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'tests/evidence/fe-001'), { recursive: true });
  writeFileSync(join(root, 'tests/bootstrap.test.mjs'), '');
  writeFileSync(join(root, 'tests/evidence/fe-001/engineering.json'), '{}');
  assert.equal(verifyApplicationTests(root, () => assert.fail('unexpected application command')), false);
  writeFileSync(join(root, 'project.config.json'), '{}');
  assert.throws(() => verifyApplicationTests(root), /Applicable application tests missing/);
});

test('application or fixture candidate fails closed until a real test command and exact dependency exist', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'fe-app-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'apps/miniprogram'), { recursive: true });
  writeFileSync(join(root, 'apps/miniprogram/app.ts'), 'export {};');
  assert.throws(() => verifyApplicationTests(root), /Applicable application tests missing/);
  rmSync(join(root, 'apps'), { recursive: true });
  mkdirSync(join(root, 'tests/fe-001'), { recursive: true });
  writeFileSync(join(root, 'tests/fe-001/contract.types.ts'), 'export {};');
  assert.throws(() => verifyApplicationTests(root), /Applicable application tests missing/);
  writeFileSync(join(root, 'tests/fe-001/contract.test.mjs'), '// synthetic guard fixture, not a real application test');
  const manifest = (scripts, vitest = '3.2.7') => writeFileSync(join(root, 'package.json'),
    JSON.stringify({ scripts, devDependencies: { vitest } }));
  manifest({});
  assert.throws(() => verifyApplicationTests(root), /Required test:app command/);
  manifest({ 'test:app': 'vitest run tests/fe-001 --passWithNoTests' });
  assert.throws(() => verifyApplicationTests(root), /Required test:app command/);
  const command = { 'test:app': 'vitest run tests/fe-001' };
  manifest(command);
  assert.throws(() => verifyApplicationTests(root), /Required exact installed Vitest/);
  mkdirSync(join(root, 'node_modules/vitest'), { recursive: true });
  const installed = (version) => writeFileSync(join(root, 'node_modules/vitest/package.json'), JSON.stringify({version}));
  installed('3.2.6');
  assert.throws(() => verifyApplicationTests(root), /Required exact installed Vitest/);
  installed('3.2.7');
  manifest(command, '^3.2.7');
  assert.throws(() => verifyApplicationTests(root), /Required exact installed Vitest/);
  manifest(command);
  const calls = [];
  assert.equal(verifyApplicationTests(root, (...args) => calls.push(args)), true);
  assert.deepEqual(calls, [['test:app', root]]);
  assert.throws(() => verifyApplicationTests(root, () => { throw new Error('test:app failed'); }), /test:app failed/);
  writeFileSync(join(root, 'tests/other.test.mjs'), '');
  assert.throws(() => verifyApplicationTests(root), /outside FE-001/);
});
