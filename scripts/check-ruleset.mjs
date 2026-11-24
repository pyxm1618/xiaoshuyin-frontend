import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REPOSITORY } from './governance.mjs';

const desired = JSON.parse(readFileSync('.specify/repository-ruleset-contract.json', 'utf8'));
assert.equal(desired.repository, REPOSITORY);
const url = `https://api.github.com/repos/${REPOSITORY}`;

export function githubHeaders(token = process.env.GITHUB_TOKEN) {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'xiaoshuyin-frontend-governance',
    ...(token ? {Authorization: `Bearer ${token}`} : {}),
  };
}

export async function githubGet(path, { token = process.env.GITHUB_TOKEN, fetchImpl = fetch, timeout = 15000 } = {}) {
  const response = await fetchImpl(url + path, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`GitHub GET ${path}: HTTP ${response.status}`);
  return response.json();
}

export async function verifyRuleset() {
  const [rulesets, effective] = await Promise.all([githubGet('/rulesets'), githubGet('/rules/branches/main')]);
  const matches = rulesets.filter(({ name, source }) => name === desired.name && source === REPOSITORY);
  assert.equal(matches.length, 1, 'Expected a single frontend-only Ruleset');
  const [{ id: rulesetId }] = matches;
  assert.equal(rulesetId, desired.id, "Unexpected frontend Ruleset ID");
  const actual = await githubGet(`/rulesets/${rulesetId}`);
  for (const field of ['source', 'target', 'enforcement']) {
    assert.equal(actual[field], field === 'source' ? REPOSITORY : desired[field]);
  }
  assert.deepEqual(actual.conditions.ref_name, desired.conditions.ref_name);
  // GitHub only exposes bypass_actors to authenticated readers with edit permission.
  if (actual.bypass_actors !== undefined) assert.deepEqual(actual.bypass_actors, []);
  const active = effective.filter(({ ruleset_id }) => ruleset_id === rulesetId);
  assert.deepEqual(active.map(({ type }) => type).sort(), desired.rules.map(({ type }) => type).sort());
  for (const { type, parameters } of desired.rules) {
    if (!parameters) continue;
    const observed = active.find((rule) => rule.type === type).parameters;
    for (const [key, value] of Object.entries(parameters)) {
      if (key === 'required_status_checks') {
        const sort = (checks) => checks.toSorted((first, second) => first.context.localeCompare(second.context));
        assert.deepEqual(sort(observed[key]), sort(value));
      } else assert.deepEqual(observed[key], value);
    }
  }
  console.log(`Active frontend Ruleset ${rulesetId} protects main; verify bypass actors with an authenticated admin read.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await verifyRuleset();
}
