import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { PATHS, verifySnapshot } from '../scripts/upstream.mjs';
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

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'xiaoshuyin-fe-governance-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text) => writeFileSync(join(root, path), text);
  const json = (path, object) => write(path, JSON.stringify(object));
  const read = (path) => readFileSync(join(root, path));
  for (const path of ['Docs', 'packages', 'specs', '.specify']) cpSync(path, join(root, path), { recursive: true });
  for (const path of [folder, 'apps/miniprogram', 'tests']) mkdirSync(join(root, path), { recursive: true });
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=Frontend fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Governance self-test fixture');
    return git('rev-parse', 'HEAD');
  };
  const spec = '**Slice**: FE-001\n\n## Upstream Traceability\n[AUTH:V1-TECHNICAL] V1-C36\n\n## Scope\nFixture\n\n## Non-goals\nProduction\n\n## Acceptance Scenarios\nFixture\n\n## Acceptance Evidence\nTest\n';
  write(`${folder}/spec.md`, spec);
  write(`${folder}/plan.md`, '## Upstream Traceability\n\n## Constitution Check\n\n## Scope Contract\n[ALLOW] apps/miniprogram/\n[ALLOW] tests/slice-fixture.test.mjs\n\n## Verification Plan\n\n## STOP Conditions\n');
  write(`${folder}/tasks.md`, `- [ ] ${taskLine}\n`);
  json(ownership, { schemaVersion: 1, repository: REPOSITORY, owners: { [applicationPath]: [feature], [testPath]: [feature] } });
  const base = commit();
  const validate = (options = {}) => validateGovernance(root, { base, repository: REPOSITORY, ...options });
  const delivery = (lawful = true) => {
    const code = lawful ? applicationPath : 'apps/miniprogram/unauthorized.ts';
    write(code, 'export {};\n');
    write(testPath, 'import { test } from "node:test"; import assert from "node:assert/strict"; test("fixture", () => assert.equal(typeof 1, "number"));\n');
    write(`${folder}/tasks.md`, `- [x] ${taskLine}\n`);
    json(bindingPath, { repository: REPOSITORY, feature, files: { [code]: digest(read(code)), [testPath]: digest(read(testPath)) } });
    json(evidencePath, { repository: REPOSITORY, feature, base, binding: digest(read(bindingPath)),
      tasks: { T001: { taskDigest: digest(taskLine), files: [code, testPath] } } });
  };
  return { root, write, json, read, spec, commit, validate, delivery };
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
