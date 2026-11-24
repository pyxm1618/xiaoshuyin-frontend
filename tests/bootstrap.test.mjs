import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { PATHS, verifySnapshot } from '../scripts/upstream.mjs';
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
const taskLine = `T001 Exercised declaration [REQ:V1-C36] [VERIFY:${testPath}]`;

function fixture(t, { audit = true, shared = false, missingPlanArtifact } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'xiaoshuyin-fe-governance-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => writeFileSync(join(root, path), text);
  const json = (path, object) => write(path, JSON.stringify(object));
  const read = (path) => readFileSync(join(root, path));
  for (const path of ['Docs', 'packages', 'specs', '.specify']) cpSync(path, join(root, path), { recursive: true });
  for (const path of [folder, 'apps/miniprogram', 'tests']) mkdirSync(join(root, path), { recursive: true });
  cpSync('package.json', join(root, 'package.json'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=Frontend fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Governance self-test fixture');
    return git('rev-parse', 'HEAD');
  };
  const spec = '**Slice**: FE-001\n\n## Upstream Traceability\n[AUTH:V1-TECHNICAL] V1-C36\n[AUTH:FE-ENGINEERING] 请求、可靠性与隐私\n\n## Scope\nFixture\n\n## Non-goals\nProduction\n\n## Acceptance Scenarios\nFixture\n\n## Acceptance Evidence\nTest\n';
  write(`${folder}/spec.md`, spec);
  write(`${folder}/plan.md`, '## Upstream Traceability\n\n## Constitution Check\n\n## Scope Contract\n[ALLOW] apps/miniprogram/\n[ALLOW] tests/slice-fixture.test.mjs\n[ALLOW] package.json\n\n## Verification Plan\n\n## STOP Conditions\n');
  write(`${folder}/tasks.md`, `- [ ] ${taskLine}\n`);
  write(`${folder}/checklist.md`, '# Captured checklist\n');
  write(`${folder}/analyze.md`, '# Captured cross-artifact analysis\n');
  if (audit) json(`${folder}/audit1.json`, { feature, role: 'Plan AI 2', decision: 'PASS', evidence: 'Synthetic audit fixture',
    artifacts: Object.fromEntries(planningFiles.map((name) => [name, planDigest(name, read(`${folder}/${name}`).toString())])) });
  if (missingPlanArtifact) rmSync(join(root, folder, missingPlanArtifact));
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
  return { root, write, json, read, spec, commit, validate, delivery, base };
}

test('local authority and contract match all listed blobs and versions', () => {
  assert.equal(verifySnapshot(process.cwd(), 'authority').files.length, 9);
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
  await assert.rejects(f.validate(), /separate reviewed registry-only/);
  assert.equal(await f.validate({base: admittedBase}), 1);
  let upstreamBlob = '0'.repeat(40);
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.includes('/git/trees/')) return Response.json({truncated:false, tree:manifest.files.map((file) => ({
      path:file.sourcePath, type:'blob', mode:'100644', sha:file.sourcePath === path ? upstreamBlob : file.sourceBlob
    }))});
    const sourcePath = decodeURIComponent(url.split(`/${manifest.sourceCommit}/`)[1]);
    return new Response(f.read(sourcePath));
  });
  await assert.rejects(f.validate({base: admittedBase, remote:true}), /Upstream blob mismatch/);
  upstreamBlob = sourceBlob;
  assert.equal(await f.validate({base: admittedBase, remote:true}), 1);
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
const technicalAuthority = 'Docs/V1技术设计.md';
const specPath = `${folder}/spec.md`;
const auditPath = `${folder}/audit1.json`;
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

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
