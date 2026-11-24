import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXPECTED_REPOSITORY = 'pyxm1618/xiaoshuyin-frontend';
const exactCommit = /^[a-f0-9]{40}$/;
const relativeHelperPath = '.specify/scripts/trusted-audit.mjs';
const relativeVerifierPath = 'scripts/governance.mjs';

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function git(root, ...args) {
  const result = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.trim();
}

function isClean(root) {
  return git(root, 'status', '--porcelain', '--untracked-files=all') === '';
}

function parseArgs(argv) {
  const values = {};
  let remote = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--remote') {
      remote = true;
      continue;
    }
    check(token.startsWith('--'), `Unexpected argument: ${token}`);
    const value = argv[index + 1];
    check(value && !value.startsWith('--'), `Missing value for ${token}`);
    values[token.slice(2)] = value;
    index += 1;
  }
  return { ...values, remote };
}

export async function runTrustedAudit({
  repository,
  base,
  head,
  trustedRoot,
  candidateRoot,
  remote = false,
  timestamp = new Date().toISOString(),
}) {
  check(repository === EXPECTED_REPOSITORY, `Wrong repository: ${repository}`);
  check(exactCommit.test(base ?? ''), 'Trusted Base must be an exact lowercase 40-hex commit SHA');
  check(exactCommit.test(head ?? ''), 'Candidate Head must be an exact lowercase 40-hex commit SHA');

  const trusted = resolve(trustedRoot);
  const candidate = resolve(candidateRoot);
  const invokedHelper = realpathSync(fileURLToPath(import.meta.url));
  const expectedHelper = join(trusted, relativeHelperPath);
  check(lstatSync(expectedHelper).isFile(), 'Trusted audit helper must be a regular file in the trusted worktree');
  check(invokedHelper === realpathSync(expectedHelper),
    'Trusted audit helper must execute from the trusted BASE worktree');

  const trustedHead = git(trusted, 'rev-parse', 'HEAD');
  check(trustedHead === base, `Trusted worktree HEAD mismatch: expected ${base}, got ${trustedHead}`);
  check(isClean(trusted), 'Trusted worktree must be clean');

  const candidateHead = git(candidate, 'rev-parse', 'HEAD');
  check(candidateHead === head, `Candidate worktree HEAD mismatch: expected ${head}, got ${candidateHead}`);
  check(isClean(candidate), 'Candidate worktree must be clean');

  const expectedOrigin = `https://github.com/${repository}.git`;
  check(git(trusted, 'remote', 'get-url', 'origin') === expectedOrigin, 'Trusted worktree origin mismatch');
  check(git(candidate, 'remote', 'get-url', 'origin') === expectedOrigin, 'Candidate worktree origin mismatch');

  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', base, head], {
    cwd: candidate,
    encoding: 'utf8',
  });
  check(ancestor.status === 0, 'Trusted Base must be an ancestor of Candidate Head');
  const mergeBase = git(candidate, 'merge-base', base, head);
  check(mergeBase === base, `Candidate merge-base mismatch: expected ${base}, got ${mergeBase}`);

  const trustedHelperIdentity = git(trusted, 'rev-parse', `${base}:${relativeHelperPath}`);
  const trustedVerifierIdentity = git(trusted, 'rev-parse', `${base}:${relativeVerifierPath}`);
  const trustedGovernanceUrl = pathToFileURL(join(trusted, relativeVerifierPath)).href;
  const trustedGovernance = await import(trustedGovernanceUrl);
  check(trustedGovernance.REPOSITORY === repository, 'Trusted verifier repository identity mismatch');

  const envelope = trustedGovernance.validateControlPlaneUpgradeEnvelope(candidate, { base, head });
  let baselineResult = envelope.baselineResult;
  if (envelope.candidateType !== 'CONTROL_PLANE') {
    await trustedGovernance.validateGovernance(candidate, {
      base,
      repository,
      remote,
    });
    baselineResult = 'PASS';
  }

  return {
    repository,
    trustedBase: base,
    candidateHead: head,
    trustedWorktreeHead: trustedHead,
    mergeBase,
    trustedVerifierIdentity,
    trustedHelperIdentity,
    candidateType: envelope.candidateType,
    changedPaths: envelope.changedPaths,
    controlPlanePaths: envelope.controlPlanePaths,
    implementationPaths: envelope.implementationPaths,
    baselineResult,
    timestamp,
  };
}

function printReport(result) {
  console.log(`Repository: ${result.repository}`);
  console.log(`Trusted Base: ${result.trustedBase}`);
  console.log(`Candidate Head: ${result.candidateHead}`);
  console.log(`Trusted Worktree Head: ${result.trustedWorktreeHead}`);
  console.log(`Merge Base: ${result.mergeBase}`);
  console.log(`Trusted Verifier Identity: ${result.trustedVerifierIdentity}`);
  console.log(`Trusted Helper Identity: ${result.trustedHelperIdentity}`);
  console.log(`Candidate Type: ${result.candidateType}`);
  console.log(`Changed Paths: ${JSON.stringify(result.changedPaths)}`);
  console.log(`Control-plane Paths: ${JSON.stringify(result.controlPlanePaths)}`);
  console.log(`Implementation Paths: ${JSON.stringify(result.implementationPaths)}`);
  console.log(`Baseline Result: ${result.baselineResult}`);
  console.log(`Timestamp: ${result.timestamp}`);
}

const invokedPath = process.argv[1] ? realpathSync(resolve(process.argv[1])) : '';
if (invokedPath && invokedPath === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await runTrustedAudit({
      repository: args.repository,
      base: args.base,
      head: args.head,
      trustedRoot: args['trusted-root'],
      candidateRoot: args['candidate-root'],
      remote: args.remote,
    });
    printReport(result);
  } catch (error) {
    console.error(`Trusted Audit FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
