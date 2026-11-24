import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PATHS, manifestPath, snapshotPaths, verifyRemote, verifySnapshot } from './upstream.mjs';

import { engineeringApproval, pathClass, validateAuditAdmission } from './governance-policy.mjs';

export const REPOSITORY = 'pyxm1618/xiaoshuyin-frontend';
const ownershipPath = '.specify/implementation-ownership.json';
const provenancePath = '.specify/task-provenance-registry.json';
const evidenceFiles = ['.specify/change-binding.json', '.specify/task-evidence.json'];
const unitPath = '.specify/authority-unit-registry.json';
const featureSyntax = /^\d{3,}-fe-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isImplementation = (path) => ['implementation', 'shared'].includes(pathClass(path));
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

function validateSync(root, base, changed, authorityPaths) {
  const paths = { ...PATHS, authority: authorityPaths };
  const kinds = Object.keys(PATHS).filter((kind) =>
    changed.some((path) => path === manifestPath(kind) || paths[kind].includes(path)));
  const impactPath = '.specify/sync-impact.json';
  check(kinds.length || !changed.includes(impactPath), 'Sync impact requires a changed upstream snapshot');
  if (!kinds.length) return [];
  check(changed.includes(impactPath) && !changed.some(isImplementation), 'Authority/contract changes require a separate controlled sync and impact');
  const impact = readJson(root, impactPath);
  check(impact.repository === REPOSITORY && sameSet(Object.keys(impact.snapshots), kinds), 'Invalid sync impact identity');
  for (const kind of kinds) {
    const previous = JSON.parse(git(root, 'show', `${base}:${manifestPath(kind)}`));
    const current = verifySnapshot(root, kind, paths[kind]);
    const scope = impact.snapshots[kind];
    const delta = paths[kind].filter((path) => changed.includes(path));
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
  validateAuditAdmission(root, binding.feature, (path) => {
    check(spawnSync('git', ['cat-file', '-e', `${base}:${path}`], { cwd: root }).status === 0, `Missing Audit 1 base artifact: ${path}`);
    return git(root, 'show', `${base}:${path}`);
  });
  const feature = features.get(binding.feature);
  const pathMatches = (path, prefix) => path === prefix || (prefix.endsWith('/') && path.startsWith(prefix));
  const featurePath = `specs/${binding.feature}/`;
  const protectedPaths = changed.filter((path) => !isImplementation(path) && !evidenceFiles.includes(path));
  check(protectedPaths.every((path) => path === featurePath + 'tasks.md'),
    'Implementation cannot change frozen Spec, plan, governance, CI or unrelated files');
  check(binding.kind === (paths.some((path) => pathClass(path) === 'shared') ? 'shared-engineering' : 'implementation'), 'Invalid Change Binding kind');
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
  const authorityPaths = snapshotPaths(root, 'authority');
  const authority = verifySnapshot(root, 'authority', authorityPaths);
  const contract = verifySnapshot(root, 'contract');
  const registry = readJson(root, unitPath);
  const imported = registry.units.filter(({ owner }) => owner === 'imported');
  const frontend = registry.units.filter(({ owner }) => owner === 'frontend');
  const units = new Map(registry.units.filter(({path}) => existsSync(join(root, path))).map(({ id, path }) => [id, path]));
  const registeredPaths = registry.units.map(({path}) => path);
  check(registry.schemaVersion === 1 && registry.units.length === new Set(registry.units.map(({id}) => id)).size &&
    registry.units.length === new Set(registeredPaths).size &&
    imported.length + frontend.length === registry.units.length &&
    PATHS.authority.every((path) => imported.some((unit) => unit.path === path)) &&
    imported.every(({path}) => PATHS.authority.includes(path) ||
      (/^Docs\/frontend\/step-4\/[a-zA-Z0-9\u3400-\u9fff_-]+\.md$/.test(path) &&
       (!existsSync(join(root, path)) || authorityPaths.includes(path)))) &&
    frontend.length === 3 && frontend.every(({id, path}) => /^Docs\/frontend\/engineering\/[^/]+\.md$/.test(path) && units.has(id)), 'Invalid Authority Unit Registry');
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
    const stray = changed.find((path) =>
      !registeredPaths.includes(path) && !PATHS.contract.includes(path) && pathClass(path) === 'unknown');
    check(!stray, `Unexpected Authority/contract path or unclassified change: ${stray}`);
    if (changed.includes('package.json') && spawnSync('git', ['cat-file', '-e', `${base}:package.json`], { cwd: root }).status === 0) {
      const previous = JSON.parse(git(root, 'show', `${base}:package.json`));
      const current = readJson(root, 'package.json');
      const protectedScripts = ['authority:check', 'contract:check', 'governance:check', 'verify-all', 'typecheck', 'test']
        .flatMap((name) => [name, `pre${name}`, `post${name}`]);
      const touched = protectedScripts.filter((name) => previous.scripts?.[name] !== current.scripts?.[name]);
      if (touched.length) {
        check(changed.every((path) => path === 'package.json' || pathClass(path) === 'governance') &&
          !changed.some((path) => evidenceFiles.includes(path) || path === ownershipPath),
        'Protected verification script requires governance change');
        for (const name of protectedScripts) {
          for (const manifest of [previous, current]) {
            if (manifest.scripts) delete manifest.scripts[name];
          }
        }
        check(JSON.stringify(previous) === JSON.stringify(current), 'Verification entry-point changes cannot include shared package edits');
        changed.splice(changed.indexOf('package.json'), 1);
      }
    }
    const bootstrapping = spawnSync('git', ['cat-file', '-e', `${base}:${unitPath}`], { cwd: root }).status !== 0;
    if (bootstrapping) {
      check(!features.size && !changed.some((path) => pathClass(path) === 'implementation'), 'Bootstrap cannot admit production changes or features');
      check(authority.sourceCommit === contract.sourceCommit && sameSet(authorityPaths, PATHS.authority) &&
        imported.length === PATHS.authority.length, 'Bootstrap authority differs from the locked baseline');
      if (remote) await Promise.all([verifyRemote(authority, 'authority'), verifyRemote(contract, 'contract')]);
    } else {
      if (changed.includes(unitPath)) {
        const prior = JSON.parse(git(root, 'show', `${base}:${unitPath}`));
        const added = registry.units.filter(({id}) => !prior.units.some((unit) => unit.id === id));
        check(changed.length === 1 && added.length > 0 &&
          prior.units.every((old) => registry.units.some((unit) => JSON.stringify(unit) === JSON.stringify(old))) &&
          added.every(({owner, path, decision}) => owner === 'imported' && !existsSync(join(root, path)) &&
            typeof decision === 'string' && decision.trim()),
        'Authority admission requires a separate reviewed registry-only change');
      }
      const localChanges = frontend.filter(({path}) => changed.includes(path));
      if (localChanges.length) {
        check(changed.every((path) => localChanges.some((unit) => unit.path === path) || pathClass(path) === 'planning'),
          'Frontend engineering Authority requires a separate change');
        check(spawnSync('git', ['cat-file', '-e', `${base}:${engineeringApproval}`], { cwd: root }).status === 0,
          'Missing prior frontend engineering Authority approval');
        const approval = JSON.parse(git(root, 'show', `${base}:${engineeringApproval}`));
        check(approval.repository === REPOSITORY && typeof approval.decision === 'string' && approval.decision.trim() &&
          sameSet(Object.keys(approval.files), localChanges.map(({path}) => path)) &&
          localChanges.every(({path}) => approval.files[path].before === sha256(git(root, 'show', `${base}:${path}`)) &&
            approval.files[path].after === sha256(readFileSync(join(root, path)))),
          'Invalid prior frontend engineering Authority approval');
      }
      if (changed.includes(engineeringApproval)) check(changed.length === 1, 'Engineering Authority approval requires its own PR');
      const priorAuthority = JSON.parse(git(root, 'show', `${base}:${manifestPath('authority')}`));
      check(priorAuthority.files.every(({sourcePath}) => authorityPaths.includes(sourcePath)),
        'Previously imported Authority cannot be removed');
      const sync = validateSync(root, base, changed, authorityPaths);
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
