import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE = 'pyxm1618/xiaoshuyin';
export const PATHS = {
  authority: [
    'Docs/总产品需求.md', 'Docs/总体技术架构.md', 'Docs/V1产品需求.md', 'Docs/V1技术设计.md',
    'Docs/frontend/README.md',
    'Docs/frontend/experience/V1前端体验原则.md',
    'Docs/frontend/information-architecture/V1前端信息架构.md',
    'Docs/frontend/interaction/V1关键状态与体验模型.md',
    'Docs/frontend/screens/V1页面与屏幕架构.md',
  ],
  contract: ['packages/generated/openapi.json', 'packages/generated/openapi.d.ts'],
};

export const manifestPath = (kind) => `.specify/${kind}-source.json`;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const blob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const commitSyntax = /^[a-f0-9]{40}$/;
const classification = (kind, path) => kind === 'contract'
  ? 'api-contract'
  : path.startsWith('Docs/frontend/') ? 'frontend-experience' : 'upstream-authority';

const authorityRegistry = '.specify/authority-unit-registry.json';
export const isAdditionalAuthority = (path) => !PATHS.authority.includes(path) &&
  /^Docs\/frontend\/(?:design-system|screens)\/[a-zA-Z0-9\u3400-\u9fff_-]+\.md$/.test(path);

function authorityScope(root, base, manifest) {
  if (base !== undefined && !commitSyntax.test(base)) throw new Error('Governance base must be an exact commit SHA');
  const revision = base ?? 'HEAD';
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const hasRegistry = git('ls-tree', '--name-only', revision, '--', authorityRegistry).trim();
  const admitted = hasRegistry
    ? JSON.parse(git('show', `${revision}:${authorityRegistry}`)).units.filter(({owner, path}) =>
      owner === 'imported' && isAdditionalAuthority(path)).map(({path}) => path)
    : [];
  const listed = new Set(manifest.files.map(({sourcePath}) => sourcePath));
  for (const directory of ['Docs/frontend/design-system', 'Docs/frontend/screens', 'Docs/frontend/step-4']) {
    if (!existsSync(join(root, directory))) continue;
    for (const name of readdirSync(join(root, directory))) {
      const path = `${directory}/${name}`;
      if (PATHS.authority.includes(path)) continue;
      if (!isAdditionalAuthority(path) || !admitted.includes(path) || !listed.has(path)) {
        throw new Error(`Unexpected Authority path without prior admission and sync: ${path}`);
      }
    }
  }
  if (hasRegistry) {
    const previous = JSON.parse(git('show', `${revision}:${manifestPath('authority')}`));
    if (previous.files.some(({sourcePath}) => !listed.has(sourcePath))) {
      throw new Error('Previously imported Authority cannot be removed');
    }
  }
  return { admitted, expected: [...PATHS.authority, ...admitted.filter((path) => listed.has(path))] };
}

function contractVersion(bytes) {
  const { openapi, info, paths } = JSON.parse(bytes);
  if (typeof openapi !== 'string' || typeof info?.version !== 'string' || !paths || !Object.keys(paths).length) {
    throw new Error('Invalid OpenAPI document metadata or empty paths');
  }
  return { openapi, info: info.version };
}

export function verifySnapshot(root, kind, { base } = {}) {
  const manifest = JSON.parse(readFileSync(join(root, manifestPath(kind)), 'utf8'));
  if (manifest.sourceRepository !== SOURCE || !commitSyntax.test(manifest.sourceCommit)) {
    throw new Error(`Invalid ${kind} repository or source commit`);
  }
  const expected = new Set(kind === 'authority' ? authorityScope(root, base, manifest).expected : PATHS[kind]);
  for (const entry of manifest.files) {
    const pathname = entry.sourcePath;
    if (!expected.delete(pathname) || entry.destinationPath !== pathname || entry.classification !== classification(kind, pathname)) {
      throw new Error(`Unexpected ${kind} manifest entry: ${pathname}`);
    }
    const file = join(root, pathname);
    if (!lstatSync(file).isFile()) throw new Error(`Expected a regular file: ${pathname}`);
    const bytes = readFileSync(file);
    if (entry.sha256 !== digest(bytes) || entry.sourceBlob !== blob(bytes)) {
      throw new Error(`Manifest content mismatch: ${pathname}`);
    }
    if (pathname.endsWith('/openapi.json')) {
      const version = contractVersion(bytes);
      if (manifest.version?.openapi !== version.openapi || manifest.version?.info !== version.info) {
        throw new Error('Contract version mismatch');
      }
    }
  }
  if (expected.size) throw new Error(`Missing ${kind} entries: ${[...expected].join(', ')}`);
  return manifest;
}

export function githubHeaders(url, token = process.env.GITHUB_TOKEN) {
  const headers = {'User-Agent': 'xiaoshuyin-frontend-governance'};
  if (new URL(url).hostname === 'api.github.com') {
    headers.Accept = 'application/vnd.github+json';
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function githubGet(url, { token = process.env.GITHUB_TOKEN, fetchImpl = fetch, timeout = 45000 } = {}) {
  const response = await fetchImpl(url, {
    headers: githubHeaders(url, token),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Upstream GET ${url}: HTTP ${response.status}`);
  return response;
}

async function sourceSnapshot(kind, commit, admitted = PATHS[kind]) {
  if (!commitSyntax.test(commit)) throw new Error('Supply a full lowercase 40-hex backend commit');
  const tree = await (await githubGet(`https://api.github.com/repos/${SOURCE}/git/trees/${commit}?recursive=1`)).json();
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Upstream tree is incomplete');
  const files = await Promise.all(admitted.map(async (pathname) => {
    const source = tree.tree.find((entry) => entry.type === 'blob' && entry.path === pathname);
    if (!source || source.mode !== '100644') throw new Error(`Missing regular upstream blob: ${pathname}`);
    const encoded = pathname.split('/').map(encodeURIComponent).join('/');
    const bytes = Buffer.from(await (await githubGet(`https://raw.githubusercontent.com/${SOURCE}/${commit}/${encoded}`)).arrayBuffer());
    if (blob(bytes) !== source.sha) throw new Error(`Upstream blob mismatch: ${pathname}`);
    return { bytes, entry: { sourcePath: pathname, sourceBlob: source.sha, destinationPath: pathname,
      sha256: digest(bytes), classification: classification(kind, pathname) } };
  }));
  return files;
}

export async function verifyRemote(manifest, kind) {
  const files = await sourceSnapshot(kind, manifest.sourceCommit, manifest.files.map(({sourcePath}) => sourcePath));
  for (const { entry } of files) {
    const local = manifest.files.find(({ sourcePath }) => sourcePath === entry.sourcePath);
    if (entry.sourceBlob !== local.sourceBlob) throw new Error(`INTEGRITY: Source commit/blob mismatch: ${entry.sourcePath}`);
  }
}

// Integrity establishes the pinned source; freshness compares only imported files
// with one resolved main commit. Unrelated backend changes do not require a sync.
export async function verifyFreshness(manifest, kind, { get = githubGet } = {}) {
  if (!PATHS[kind] || manifest.sourceRepository !== SOURCE || !commitSyntax.test(manifest.sourceCommit) ||
      !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error(`Invalid ${kind} freshness manifest`);
  }
  const reference = await (await get(`https://api.github.com/repos/${SOURCE}/git/ref/heads/main`)).json();
  const main = reference.object?.sha;
  if (reference.ref !== 'refs/heads/main' || reference.object?.type !== 'commit' || !commitSyntax.test(main)) {
    throw new Error('Invalid upstream main reference');
  }
  const tree = await (await get(`https://api.github.com/repos/${SOURCE}/git/trees/${main}?recursive=1`)).json();
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Upstream main tree is incomplete');
  const changed = manifest.files.filter(({sourcePath, sourceBlob}) => {
    const upstream = tree.tree.filter((entry) => entry.path === sourcePath);
    return upstream.length !== 1 || upstream[0].type !== 'blob' ||
      upstream[0].mode !== '100644' || upstream[0].sha !== sourceBlob;
  }).map(({sourcePath}) => sourcePath);
  if (changed.length) {
    throw new Error(`STALE ${kind}: upstream main ${main} differs from pinned ${manifest.sourceCommit}: ${changed.join(', ')}; impact assessment and controlled sync required`);
  }
  return { kind, sourceCommit: manifest.sourceCommit, main, status: 'CURRENT', files: manifest.files.length };
}

function operations(bytes) {
  const spec = JSON.parse(bytes);
  return new Set(Object.entries(spec.paths).flatMap(([path, item]) =>
    ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']
      .filter((verb) => Object.hasOwn(item, verb)).map((verb) => `${verb.toUpperCase()} ${path}`)));
}

async function preview(root, kind, commit, destination) {
  if (!PATHS[kind] || !destination) throw new Error('Usage: preview authority|contract COMMIT NEW_OUTSIDE_DIRECTORY');
  const output = resolve(destination);
  if (output === root || output.startsWith(`${root}/`)) throw new Error('Preview must be outside the checkout');
  const current = verifySnapshot(root, kind);
  const scope = kind === 'authority' ? [...PATHS.authority, ...authorityScope(root, undefined, current).admitted] : PATHS[kind];
  const files = await sourceSnapshot(kind, commit, scope);
  const manifest = { sourceRepository: SOURCE, sourceCommit: commit, files: files.map(({ entry }) => entry) };
  const changed = manifest.files.filter((entry) => current.files.find((old) =>
    old.sourcePath === entry.sourcePath)?.sourceBlob !== entry.sourceBlob).map(({ sourcePath }) => sourcePath);
  const diff = { changed, classification: changed.length ? 'REVIEW_REQUIRED' : 'IDENTICAL' };
  if (kind === 'contract') {
    const next = files.find(({ entry }) => entry.sourcePath.endsWith('/openapi.json')).bytes;
    manifest.version = contractVersion(next);
    const before = operations(readFileSync(join(root, 'packages/generated/openapi.json')));
    const after = operations(next);
    diff.removedOperations = [...before].filter((operation) => !after.has(operation));
    diff.addedOperations = [...after].filter((operation) => !before.has(operation));
    if (diff.removedOperations.length) diff.classification = 'BREAKING_OPERATION_REMOVAL';
  }
  mkdirSync(output);
  for (const { bytes, entry } of files) {
    const path = join(output, entry.destinationPath);
    mkdirSync(resolve(path, '..'), { recursive: true });
    writeFileSync(path, bytes, { flag: 'wx' });
  }
  mkdirSync(join(output, '.specify'));
  writeFileSync(join(output, manifestPath(kind)), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(join(output, 'diff.json'), JSON.stringify(diff, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(diff));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'preview') await preview(process.cwd(), ...args);
  else {
    if (!PATHS[command] || args.some((arg) => arg !== '--remote')) throw new Error('Expected authority, contract, or preview');
    const manifest = verifySnapshot(process.cwd(), command, { base: process.env.GOVERNANCE_BASE || undefined });
    if (args.includes('--remote')) {
      await verifyRemote(manifest, command);
      console.log(JSON.stringify(await verifyFreshness(manifest, command)));
    }
    console.log(`${command} integrity PASS ${manifest.files.length} files at ${manifest.sourceCommit}`);
  }
}
