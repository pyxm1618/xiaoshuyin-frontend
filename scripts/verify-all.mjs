import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function runCommand(command, root = process.cwd()) {
  const result = spawnSync('bun', ['run', command], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.signal ?? result.status}`);
}

// FE-001's frozen application test scope; future slices need an explicitly reviewed extension.
export function verifyApplicationTests(root, run = runCommand) {
  const testRoot = join(root, 'tests');
  const tests = existsSync(testRoot) ? readdirSync(testRoot, { withFileTypes: true }) : [];
  const candidates = tests.filter((entry) => !['bootstrap.test.mjs', 'evidence'].includes(entry.name));
  const applicable = existsSync(join(root, 'apps/miniprogram')) ||
    existsSync(join(root, 'project.config.json')) || candidates.length > 0;
  if (!applicable) return false;

  if (candidates.some((entry) => entry.name !== 'fe-001')) {
    throw new Error('Application test scope outside FE-001 requires reviewed verification integration');
  }
  const suite = join(testRoot, 'fe-001');
  if (!existsSync(suite) || !readdirSync(suite, { recursive: true, withFileTypes: true })
    .some((entry) => entry.isFile() && entry.name.endsWith('.test.mjs'))) {
    throw new Error('Applicable application tests missing: tests/fe-001/**/*.test.mjs');
  }
  const manifest = readJson(join(root, 'package.json'));
  if (manifest.scripts?.['test:app'] !== 'vitest run tests/fe-001') {
    throw new Error('Required test:app command: vitest run tests/fe-001');
  }
  const installed = join(root, 'node_modules/vitest/package.json');
  if (manifest.devDependencies?.vitest !== '3.2.7' ||
      !existsSync(installed) || readJson(installed).version !== '3.2.7') {
    throw new Error('Required exact installed Vitest 3.2.7');
  }
  run('test:app', root);
  return true;
}

function verifyAll() {
  const tools = readJson('package.json');
  if (process.versions.node !== tools.engines.node) throw new Error(`Expected Node ${tools.engines.node}`);
  const bunVersion = spawnSync('bun', ['--version'], { encoding: 'utf8' });
  if (bunVersion.status !== 0 || `bun@${bunVersion.stdout.trim()}` !== tools.packageManager) {
    throw new Error(`Expected ${tools.packageManager}`);
  }
  for (const command of ['authority:check', 'contract:check', 'governance:check', 'typecheck', 'test']) {
    runCommand(command);
  }
  if (!verifyApplicationTests(process.cwd())) {
    console.log('Application tests: NOT APPLICABLE (no application or test candidate)');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  verifyAll();
}
