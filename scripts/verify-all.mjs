import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tools = JSON.parse(readFileSync('package.json', 'utf8'));
if (process.versions.node !== tools.engines.node) throw new Error(`Expected Node ${tools.engines.node}`);
const bunVersion = spawnSync('bun', ['--version'], { encoding: 'utf8' });
if (bunVersion.status !== 0 || `bun@${bunVersion.stdout.trim()}` !== tools.packageManager) {
  throw new Error(`Expected ${tools.packageManager}`);
}
for (const command of ['authority:check', 'contract:check', 'governance:check', 'typecheck', 'test']) {
  const result = spawnSync('bun', ['run', command], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.signal ?? result.status}`);
}
