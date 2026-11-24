import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PATHS, manifestPath, verifyRemote, verifySnapshot } from './upstream.mjs';

export const REPOSITORY = 'pyxm1618/xiaoshuyin-frontend';
const ownershipPath = '.specify/implementation-ownership.json';
const provenancePath = '.specify/task-provenance-registry.json';
const evidenceFiles = ['.specify/change-binding.json', '.specify/task-evidence.json'];
const unitPath = '.specify/authority-unit-registry.json';
const featureSyntax = /^\d{3,}-fe-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isImplementation = (path) => /^(apps\/|packages\/(?!generated\/)|tests\/(?!bootstrap\.test\.mjs$))/.test(path);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const readJson = (root, path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  check(result.status === 0, `git ${args.join(' ')}: ${result.stderr || result.error?.message}`);
  return result.stdout;
}

function sameSet(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    new Set(actual).size === actual.length && expected.every((entry) => actual.includes(entry));
}

function sections(text, labels, path) {
  const present = new Set([...text.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim()));
  for (const label of labels) check(present.has(label), `${path}: missing section ${label}`);
}

function tasks(text, path) {
  const taskMap = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!/^- \[[ xX]\]/.test(line)) continue;
    const match = line.match(/^- \[([ xX])\] (T\d{3,})\b.+? \[REQ:([^\]]+)\] \[VERIFY:(tests\/[a-zA-Z0-9._/-]+\.test\.mjs)\]$/);
    check(match, `${path}: malformed task ${line}`);
    check(!taskMap.has(match[2]), `${path}: duplicate task ${match[2]}`);
    check(!match[4].split('/').includes('..'), `${path}: invalid verification path`);
    taskMap.set(match[2], { complete: match[1] !== ' ', req: match[3], verify: match[4], digest: sha256(line.slice(6)) });
  }
  check(taskMap.size > 0, `${path}: no tasks`);
  return taskMap;
}

export function validateSpecs(root, units) {
  const features = new Map();
  const ids = new Set();
  for (const entry of readdirSync(join(root, 'specs'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    check(featureSyntax.test(name), `Invalid Spec Kit frontend feature directory: ${name}`);
    const folder = `specs/${name}`;
    const id = `FE-${name.split('-')[0]}`;
    check(!ids.has(id), `Duplicate slice ID ${id}`);
    ids.add(id);
    const spec = readFileSync(join(root, folder, 'spec.md'), 'utf8');
    sections(spec, ['Upstream Traceability', 'Scope', 'Non-goals', 'Acceptance Scenarios', 'Acceptance Evidence'], folder);
    check(spec.includes(`**Slice**: ${id}\n`), `${folder}: missing exact slice ID ${id}`);
    const refs = [...spec.matchAll(/^\[AUTH:([A-Z0-9-]+)\] (.+)$/gm)];
    check(refs.length && refs.every(([, unit]) => units.has(unit)), `${folder}: missing or invalid Authority reference`);
    for (const [, unit, selector] of refs) {
      const source = readFileSync(join(root, units.get(unit)), 'utf8');
      check(selector.trim().length > 2 && source.includes(selector.trim()), `${folder}: unresolved Authority selector ${unit} ${selector}`);
    }
    const plan = join(root, folder, 'plan.md');
    let allowed = [];
    let forbidden = [];
    const taskPath = join(root, folder, 'tasks.md');
    if (existsSync(plan)) {
      const planText = readFileSync(plan, 'utf8');
      sections(planText, ['Upstream Traceability', 'Constitution Check', 'Scope Contract', 'Verification Plan', 'STOP Conditions'], plan);
      allowed = [...planText.matchAll(/^\[ALLOW\] (.+)$/gm)].map((match) => match[1]);
      forbidden = [...planText.matchAll(/^\[FORBID\] (.+)$/gm)].map((match) => match[1]);
      check(allowed.length && allowed.every(isImplementation), `${plan}: missing valid Allowed Paths`);
    }
    let records = new Map();
    if (existsSync(taskPath)) {
      check(existsSync(plan), `${folder}: tasks require plan`);
      records = tasks(readFileSync(taskPath, 'utf8'), taskPath);
      for (const task of records.values()) check(refs.some(([, , selector]) => selector.trim() === task.req), `${folder}: unbound task requirement ${task.req}`);
    }
    features.set(name, { id, records, allowed, forbidden });
  }
  return features;
}

function validateSync(root, base, changed) {
  const kinds = Object.keys(PATHS).filter((kind) =>
    changed.some((path) => path === manifestPath(kind) || PATHS[kind].includes(path)));
  const impactPath = '.specify/sync-impact.json';
  check(kinds.length || !changed.includes(impactPath), 'Sync impact requires a changed upstream snapshot');
  if (!kinds.length) return [];
  check(changed.includes(impactPath) && !changed.some(isImplementation), 'Authority/contract changes require a separate controlled sync and impact');
  const impact = readJson(root, impactPath);
  check(impact.repository === REPOSITORY && sameSet(Object.keys(impact.snapshots), kinds), 'Invalid sync impact identity');
  for (const kind of kinds) {
    const previous = JSON.parse(git(root, 'show', `${base}:${manifestPath(kind)}`));
    const current = verifySnapshot(root, kind);
    const scope = impact.snapshots[kind];
    const delta = PATHS[kind].filter((path) => changed.includes(path));
    check(delta.length && changed.includes(manifestPath(kind)) &&
      scope.previous === previous.sourceCommit && scope.next === current.sourceCommit &&
      scope.previous !== scope.next && sameSet(scope.files, delta), `Invalid ${kind} sync impact`);
    check(typeof scope.rationale === 'string' && scope.rationale.trim().length > 0, `Missing ${kind} downstream analysis`);
    const dependentSpecs = changed.filter((path) => /^specs\/.*\.md$/.test(path));
    check(sameSet(scope.changedSpecArtifacts, dependentSpecs), `Unreconciled ${kind} downstream artifacts`);
    for (const path of dependentSpecs) check(existsSync(join(root, path)), `Missing downstream artifact: ${path}`);
  }
  return kinds;
}

function validateDelivery(root, base, changed, features, ownership) {
  const implementation = changed.filter(isImplementation);
  const [bindingPath, evidencePath] = evidenceFiles;
  for (const path of changed.filter((path) => /^specs\/.*\/(spec|plan|tasks)\.md$/.test(path))) {
    check(existsSync(join(root, path)), `Removed governed Spec artifact: ${path}`);
  }
  const completed = [];
  for (const [feature, { records }] of features) {
    const path = `specs/${feature}/tasks.md`;
    if (!changed.includes(path)) continue;
    const hasOld = spawnSync('git', ['cat-file', '-e', `${base}:${path}`], { cwd: root }).status === 0;
    const previous = hasOld ? tasks(git(root, 'show', `${base}:${path}`), path) : new Map();
    for (const [id, oldTask] of previous) {
      if (oldTask.complete) check(records.get(id)?.complete && records.get(id).digest === oldTask.digest, `Frozen completed task changed: ${feature}/${id}`);
    }
    for (const [id, task] of records) {
      if (task.complete && !previous.get(id)?.complete) completed.push({ feature, id, ...task });
    }
  }
  if (!implementation.length && !completed.length) {
    check(!changed.includes(bindingPath) && !changed.includes(evidencePath), 'Changed binding or evidence without current implementation');
    return;
  }
  check(implementation.length && completed.length, 'Implementation requires newly completed tasks and concrete evidence');
  check(!changed.includes(ownershipPath) && !changed.includes(provenancePath), 'Registry admission and implementation require separate PRs');
  check(changed.includes(bindingPath) && changed.includes(evidencePath), 'Missing current Change Binding or Task Evidence');
  const binding = readJson(root, bindingPath);
  const evidence = readJson(root, evidencePath);
  const paths = Object.keys(binding.files);
  check(binding.repository === REPOSITORY && features.has(binding.feature) && sameSet(paths, implementation), 'Invalid Change Binding');
  const feature = features.get(binding.feature);
  const pathMatches = (path, prefix) => path === prefix || (prefix.endsWith('/') && path.startsWith(prefix));
  const featurePath = `specs/${binding.feature}/`;
  const protectedPaths = changed.filter((path) => !isImplementation(path) && !evidenceFiles.includes(path));
  check(protectedPaths.every((path) => path === featurePath + 'tasks.md'),
    'Implementation cannot change frozen Spec, plan, governance, CI or unrelated files');
  for (const path of paths) {
    const owner = Object.keys(ownership.owners).filter((prefix) =>
      pathMatches(path, prefix)).sort((a, b) => b.length - a.length)[0];
    check(owner && ownership.owners[owner].includes(binding.feature), `Unauthorized implementation path: ${path}`);
    check(feature.allowed.some((prefix) => pathMatches(path, prefix)) &&
      !feature.forbidden.some((prefix) => pathMatches(path, prefix)), `Path outside the frozen Plan: ${path}`);
    check(existsSync(join(root, path)) && binding.files[path] === sha256(readFileSync(join(root, path))), `Change Binding content mismatch: ${path}`);
  }
  check(evidence.repository === REPOSITORY && evidence.feature === binding.feature &&
    evidence.base === base && evidence.binding === sha256(readFileSync(join(root, bindingPath))) &&
    completed.every((task) => task.feature === binding.feature), 'Task Evidence belongs to a different candidate/base');
  check(sameSet(Object.keys(evidence.tasks), completed.map(({ id }) => id)), 'Task Evidence must cover exactly the current completed tasks');
  const evidencedPaths = new Set();
  for (const { id, digest, verify } of completed) {
    const proof = evidence.tasks[id];
    check(proof.taskDigest === digest && paths.includes(verify) && proof.files.includes(verify) &&
      proof.files.every((path) => paths.includes(path)), `Invalid or historical Task Evidence: ${id}`);
    for (const path of proof.files) evidencedPaths.add(path);
  }
  check(sameSet([...evidencedPaths], paths), 'Uncovered implementation changes');
}

export async function validateGovernance(root, { base, repository, remote = false } = {}) {
  if (repository !== undefined) check(repository === REPOSITORY, `Wrong repository: ${repository}`);
  if (!repository) check(git(root, 'remote', 'get-url', 'origin').trim() === `https://github.com/${REPOSITORY}.git`, 'Wrong repository origin');
  const authority = verifySnapshot(root, 'authority');
  const contract = verifySnapshot(root, 'contract');
  const registry = readJson(root, unitPath);
  const units = new Map(registry.units.map(({ id, path }) => [id, path]));
  check(registry.schemaVersion === 1 && registry.units.length === units.size &&
    sameSet([...units.values()], PATHS.authority), 'Invalid Authority Unit Registry');
  const features = validateSpecs(root, units);
  const ownership = readJson(root, ownershipPath);
  const provenance = readJson(root, provenancePath);
  for (const [path, registry] of [[ownershipPath, ownership], [provenancePath, provenance]]) {
    check(registry.schemaVersion === 1 && registry.repository === REPOSITORY, `Invalid registry identity: ${path}`);
  }
  for (const [path, owners] of Object.entries(ownership.owners)) {
    check(isImplementation(path) && !path.includes('..') && owners.length && owners.every((owner) => features.has(owner)), `Invalid ownership registration: ${path}`);
  }
  check(provenance.mode === 'git-history-and-current-delta' && sameSet(provenance.evidenceFiles, evidenceFiles), 'Invalid task provenance policy');
  if (base) {
    check(/^[a-f0-9]{40}$/.test(base), 'Governance base must be an exact commit SHA');
    const changed = git(root, 'diff', '--no-renames', '--name-only', '-z', base, 'HEAD').split('\0').filter(Boolean);
    const permittedDocs = new Set([...PATHS.authority,
      ...['V1前端工程技术设计.md', 'V1前端开发与验收规范.md', '前后端合同与集成规范.md']
        .map((file) => `Docs/frontend/engineering/${file}`)]);
    const stray = changed.find((path) => (path.startsWith('Docs/') && !permittedDocs.has(path)) ||
      (path.startsWith('packages/generated/') && !PATHS.contract.includes(path)));
    check(!stray, `Unexpected Authority/contract path: ${stray}`);
    const bootstrapping = spawnSync('git', ['cat-file', '-e', `${base}:${unitPath}`], { cwd: root }).status !== 0;
    if (bootstrapping) {
      check(!features.size && !changed.some(isImplementation), 'Bootstrap cannot admit production changes or features');
      check(authority.sourceCommit === contract.sourceCommit, 'Bootstrap source commits differ');
      if (remote) await Promise.all([verifyRemote(authority, 'authority'), verifyRemote(contract, 'contract')]);
    } else {
      check(!changed.includes(unitPath), 'Authority unit topology requires a separate reviewed governance update');
      const sync = validateSync(root, base, changed);
      if (remote) await Promise.all(sync.map((kind) => verifyRemote(kind === 'authority' ? authority : contract, kind)));
      const baseOwnership = JSON.parse(git(root, 'show', `${base}:${ownershipPath}`));
      validateDelivery(root, base, changed, features, baseOwnership);
    }
  }
  if (remote && !base) await Promise.all([verifyRemote(authority, 'authority'), verifyRemote(contract, 'contract')]);
  return features.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = await validateGovernance(process.cwd(), {
    repository: process.env.GITHUB_REPOSITORY,
    base: process.env.GOVERNANCE_BASE,
    remote: process.argv.includes('--remote'),
  });
  console.log(`Spec Governance PASS (${count} registered slices)`);
}
