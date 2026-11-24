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
} from '../scripts/upstream.mjs';
import {
  githubGet as rulesetGithubGet,
  githubHeaders as rulesetGithubHeaders,
} from '../scripts/check-ruleset.mjs';
import { engineeringApproval, planDigest, planningFiles } from '../scripts/governance-policy.mjs';
import { REPOSITORY, validateGovernance } from '../scripts/governance.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const feature = '001-fe-fixture';
const folder = `specs/${feature}`;
const ownership = '.specify/implementation-ownership.json';
const testPath = 'tests/slice-fixture.test.mjs';
const applicationPath = 'apps/miniprogram/fixture.ts';
const bindingPath = '.specify/change-binding.json';
const evidencePath = '.specify/task-evidence.json';
const technicalAuthority = 'Docs/V1技术设计.md';
const engineeringAuthority = 'Docs/frontend/engineering/V1前端工程技术设计.md';
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const taskLine = `T001 Exercised declaration [REQ:V1-C36] [VERIFY:${testPath}]`;

function fixture(t, { audit = true, shared = false, missingPlanArtifact, lifecycle = false } = {}) {
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
  const authorityUnits = [
    ...PATHS.authority.map((path, i) => ({id: path === technicalAuthority ? 'V1-TECHNICAL' : `FIXTURE-${i}`, path, owner: 'imported'})),
    {id: 'FE-ENGINEERING', path: engineeringAuthority, owner: 'frontend'},
    {id: 'FE-DELIVERY', path: 'Docs/frontend/engineering/V1前端开发与验收规范.md', owner: 'frontend'},
    {id: 'FE-INTEGRATION', path: 'Docs/frontend/engineering/前后端合同与集成规范.md', owner: 'frontend'},
  ];
  for (const {path} of authorityUnits) {
    mkdirSync(join(root, path, '..'), {recursive: true});
    const text = path === technicalAuthority ? '| V1-C36 | 现有微信小程序为家庭主端，不另建家庭 Web |'
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
  const spec = '**Slice**: FE-001\n\n## Upstream Traceability\n[AUTH:V1-TECHNICAL] V1-C36\n[AUTH:FE-ENGINEERING] 请求、可靠性与隐私\n\n## Scope\nFixture\n\n## Non-goals\nProduction\n\n## Acceptance Scenarios\nFixture\n\n## Acceptance Evidence\nTest\n';
  const bootstrapBase = lifecycle ? commit() : undefined;
  write(`${folder}/spec.md`, spec);
  const specified = lifecycle ? commit() : undefined;
  if (lifecycle) write(`${folder}/spec.md`, spec + '\n## Clarifications\nSynthetic clarification frozen.\n');
  const frozen = lifecycle ? commit() : undefined;
  write(`${folder}/plan.md`, '## Upstream Traceability\n\n## Constitution Check\n\n## Scope Contract\n[ALLOW] apps/miniprogram/\n[ALLOW] tests/slice-fixture.test.mjs\n[ALLOW] package.json\n\n## Verification Plan\n\n## STOP Conditions\n');
  write(`${folder}/tasks.md`, `- [ ] ${taskLine}\n`);
  write(`${folder}/checklist.md`, '# Captured checklist\n');
  write(`${folder}/analyze.md`, '# Captured cross-artifact analysis\n');
  const analyzed = lifecycle ? commit() : undefined;
  if (audit) json(`${folder}/audit1.json`, { feature, role: 'Plan AI 2', decision: 'PASS', evidence: 'Synthetic audit fixture',
    artifacts: Object.fromEntries(planningFiles.map((name) => [name, planDigest(name, read(`${folder}/${name}`).toString())])) });
  if (missingPlanArtifact) rmSync(join(root, folder, missingPlanArtifact));
  const audited = lifecycle ? commit() : undefined;
  json(ownership, { schemaVersion: 1, repository: REPOSITORY, owners: {
    [applicationPath]: [feature], [testPath]: [feature], ...(shared && {'package.json': [feature]}) } });
  const base = commit();
  const validate = (options = {}) => validateGovernance(root, { base, repository: REPOSITORY, ...options });
  const delivery = (lawful = true, deliveryBase = base) => {
    const code = lawful ? applicationPath : 'apps/miniprogram/unauthorized.ts';
    write(code, 'export {};\n');
    write(testPath, 'import { test } from "node:test"; import assert from "node:assert/strict"; test("fixture", () => assert.equal(typeof 1, "number"));\n');
    write(`${folder}/tasks.md`, read(`${folder}/tasks.md`).toString().replace(/^- \[ \] T001 /m, '- [x] T001 '));
    if (shared) json('package.json', {...JSON.parse(read('package.json')), description: 'Synthetic shared tooling edit'});
    const paths = [code, testPath, ...(shared ? ['package.json'] : [])];
    json(bindingPath, { repository: REPOSITORY, feature, kind: shared ? 'shared-engineering' : 'implementation',
      files: Object.fromEntries(paths.map((path) => [path, digest(read(path))])) });
    json(evidencePath, { repository: REPOSITORY, feature, base: deliveryBase, binding: digest(read(bindingPath)),
      tasks: { T001: { taskDigest: digest(taskLine), files: paths } } });
  };
  return { root, write, json, read, spec, commit, validate, delivery, base, bootstrapBase, specified, frozen, analyzed, audited, git };
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

test('F01 engineering Authority edits require a prior exact-byte approval', async (t) => {
  const f = fixture(t);
  const path = 'Docs/frontend/engineering/V1前端工程技术设计.md';
  const before = f.read(path);
  const after = Buffer.concat([before, Buffer.from('\nSynthetic change.\n')]);
  f.write(path, after);
  f.commit();
  await assert.rejects(f.validate(), /Missing prior frontend engineering Authority approval/);
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
  await assert.rejects(f.validate({base: approvedBase}), /Invalid prior frontend engineering Authority approval/);
});

test('F02 Step 4 requires separate registry admission, source provenance, and intact existing imports', async (t) => {
  const f = fixture(t);
  const path = 'Docs/frontend/step-4/fixture.md';
  const bytes = Buffer.from('# Frozen synthetic source\n');
  mkdirSync(join(f.root, 'Docs/frontend/step-4'));
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
    if (url.includes('/git/trees/') && !url.endsWith(`/${'a'.repeat(40)}?recursive=1`)) return new Response(null, {status: 404});
    if (url.includes('/git/trees/')) return Response.json({truncated:false, tree:manifest.files.map((file) => ({
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
  f.write(dir + '/spec.md', citeChangedAuthority ? spec : spec.replace('[AUTH:V1-TECHNICAL] V1-C36\n', ''));
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
  f.write(second, f.read(second).toString().replace('[AUTH:V1-TECHNICAL] V1-C36\n', ''));
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
  const f = fixture(t);
  f.write(specPath, f.spec.replace('[AUTH:V1-TECHNICAL] V1-C36', '[AUTH:FE-ENGINEERING] 请求、可靠性与隐私'));
  f.write(`${folder}/tasks.md`, `- [ ] ${taskLine.replace('V1-C36', '请求、可靠性与隐私')}\n`);
  const base = f.commit();
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
    await assert.rejects(f.validate(), /separate tsconfig.json-only governance PR/);
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


const trustedAuditRelative = '.specify/scripts/trusted-audit.mjs';

function trustedAuditFixture(t) {
  const f = fixture(t);
  mkdirSync(join(f.root, 'scripts'), {recursive: true});
  mkdirSync(join(f.root, '.specify/scripts'), {recursive: true});
  for (const path of ['scripts/governance.mjs', 'scripts/governance-policy.mjs', 'scripts/upstream.mjs']) {
    f.write(path, readFileSync(path));
  }
  f.write(trustedAuditRelative, readFileSync(trustedAuditRelative));
  f.git('remote', 'add', 'origin', `https://github.com/${REPOSITORY}.git`);
  const trustBase = f.commit();
  const parent = mkdtempSync(join(tmpdir(), 'xiaoshuyin-fe-trusted-worktree-'));
  const trustedRoot = join(parent, 'base');
  f.git('worktree', 'add', '--detach', trustedRoot, trustBase);
  t.after(() => rmSync(parent, {recursive: true, force: true}));

  const run = (overrides = {}) => {
    const script = overrides.script ?? join(trustedRoot, trustedAuditRelative);
    const head = overrides.head ?? f.git('rev-parse', 'HEAD');
    const args = [
      script,
      '--repository', REPOSITORY,
      '--base', overrides.base ?? trustBase,
      '--head', head,
      '--trusted-root', overrides.trustedRoot ?? trustedRoot,
      '--candidate-root', overrides.candidateRoot ?? f.root,
    ];
    if (overrides.remote) args.push('--remote');
    return spawnSync(process.execPath, args, {encoding: 'utf8'});
  };

  return {...f, trustBase, trustedRoot, run};
}

test('R1-T01 trusted worktree HEAD must equal requested BASE', (t) => {
  const f = trustedAuditFixture(t);
  const result = f.run({base: f.base});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Trusted worktree HEAD mismatch/);
});

test('R1-T02 candidate worktree HEAD must equal requested HEAD', (t) => {
  const f = trustedAuditFixture(t);
  f.delivery(true, f.trustBase);
  f.commit();
  const result = f.run({head: f.trustBase});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Candidate worktree HEAD mismatch/);
});

test('R1-T03 trusted worktree must be clean', (t) => {
  const f = trustedAuditFixture(t);
  writeFileSync(join(f.trustedRoot, 'dirty.txt'), 'dirty');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Trusted worktree must be clean/);
});

test('R1-T04 candidate worktree must be clean', (t) => {
  const f = trustedAuditFixture(t);
  writeFileSync(join(f.root, 'dirty.txt'), 'dirty');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Candidate worktree must be clean/);
});

test('R1-T05 BASE must be an ancestor of candidate HEAD', (t) => {
  const f = trustedAuditFixture(t);
  f.delivery(true, f.trustBase);
  const head = f.commit();
  const tree = f.git('rev-parse', `${f.trustBase}^{tree}`);
  const unrelated = f.git(
    '-c', 'user.name=Frontend fixture',
    '-c', 'user.email=fixture@example.invalid',
    'commit-tree', tree, '-m', 'Unrelated trust root',
  );
  const parent = mkdtempSync(join(tmpdir(), 'xiaoshuyin-fe-unrelated-worktree-'));
  const unrelatedRoot = join(parent, 'base');
  f.git('worktree', 'add', '--detach', unrelatedRoot, unrelated);
  t.after(() => rmSync(parent, {recursive: true, force: true}));
  const result = f.run({
    base: unrelated,
    head,
    trustedRoot: unrelatedRoot,
    script: join(unrelatedRoot, trustedAuditRelative),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Trusted Base must be an ancestor/);
});

test('R1-T06/T11/T12 ordinary implementation uses BASE governance and binds exact identities', (t) => {
  const f = trustedAuditFixture(t);
  f.delivery(true, f.trustBase);
  const head = f.commit();
  const result = f.run({head});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Candidate Type: ORDINARY_IMPLEMENTATION/);
  assert.match(result.stdout, /Baseline Result: PASS/);
  assert.match(result.stdout, new RegExp(`Trusted Base: ${f.trustBase}`));
  assert.match(result.stdout, new RegExp(`Candidate Head: ${head}`));
  assert.match(result.stdout, new RegExp(
    `Trusted Verifier Identity: ${f.git('rev-parse', `${f.trustBase}:scripts/governance.mjs`)}`,
  ));
  assert.match(result.stdout, new RegExp(
    `Trusted Helper Identity: ${f.git('rev-parse', `${f.trustBase}:${trustedAuditRelative}`)}`,
  ));
});

test('R1-T07/T09 implementation mixed with control-plane governance is rejected', (t) => {
  const f = trustedAuditFixture(t);
  f.delivery(true, f.trustBase);
  f.write('scripts/governance.mjs', Buffer.concat([
    f.read('scripts/governance.mjs'),
    Buffer.from('\n// mixed control-plane change\n'),
  ]));
  const head = f.commit();
  const result = f.run({head});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot include implementation paths/);
});

test('R1-T08 pure control-plane candidate requires independent review instead of trusted PASS', (t) => {
  const f = trustedAuditFixture(t);
  f.write('scripts/governance.mjs', Buffer.concat([
    f.read('scripts/governance.mjs'),
    Buffer.from('\n// pure control-plane change\n'),
  ]));
  const head = f.commit();
  const result = f.run({head});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Candidate Type: CONTROL_PLANE/);
  assert.match(result.stdout, /Baseline Result: CONTROL_PLANE_REVIEW_REQUIRED/);
  assert.doesNotMatch(result.stdout, /Baseline Result: PASS/);
});

test('R1-T10 R2-style schema upgrade remains inside the control-plane envelope', (t) => {
  const f = trustedAuditFixture(t);
  f.write('scripts/governance.mjs', Buffer.concat([
    f.read('scripts/governance.mjs'),
    Buffer.from('\n// future R2 governance schema\n'),
  ]));
  f.json('.specify/task-provenance-registry.json', {
    schemaVersion: 2,
    repository: REPOSITORY,
    mode: 'per-slice-delivery-evidence',
    evidenceFiles: {binding: 'specs/<feature>/change-binding.json', evidence: 'specs/<feature>/task-evidence.json'},
  });
  f.write('specs/README.md', '# Future R2 per-slice evidence\n');
  f.write('tests/bootstrap.test.mjs', '// Future R2 governance regression tests\n');
  const head = f.commit();
  const result = f.run({head});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Candidate Type: CONTROL_PLANE/);
  assert.match(result.stdout, /CONTROL_PLANE_REVIEW_REQUIRED/);
});

test('R1-T13 BASE trusted audit reads but never executes candidate test code', (t) => {
  const f = trustedAuditFixture(t);
  f.delivery(true, f.trustBase);
  f.write(testPath, 'throw new Error("candidate test code executed");\n');
  const binding = JSON.parse(f.read(bindingPath));
  binding.files[testPath] = digest(f.read(testPath));
  f.json(bindingPath, binding);
  const evidence = JSON.parse(f.read(evidencePath));
  evidence.binding = digest(f.read(bindingPath));
  f.json(evidencePath, evidence);
  const head = f.commit();
  const result = f.run({head});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Baseline Result: PASS/);
});

test('R1-T14 candidate copy of helper cannot impersonate the trusted BASE helper', (t) => {
  const f = trustedAuditFixture(t);
  f.write(trustedAuditRelative, Buffer.concat([
    f.read(trustedAuditRelative),
    Buffer.from('\n// candidate helper copy\n'),
  ]));
  const head = f.commit();
  const result = f.run({
    head,
    script: join(f.root, trustedAuditRelative),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must execute from the trusted BASE worktree/);
});
