import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REPOSITORY } from './governance.mjs';

const desired = JSON.parse(readFileSync('.specify/repository-ruleset-contract.json', 'utf8'));
assert.equal(desired.repository, REPOSITORY);
const url = `https://api.github.com/repos/${REPOSITORY}`;
async function get(path) {
  const response = await fetch(url + path, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GitHub GET ${path}: HTTP ${response.status}`);
  return response.json();
}
const [rulesets, effective] = await Promise.all([get('/rulesets'), get('/rules/branches/main')]);
const matches = rulesets.filter(({ name, source }) => name === desired.name && source === REPOSITORY);
assert.equal(matches.length, 1, 'Expected a single frontend-only Ruleset');
const [{ id: rulesetId }] = matches;
const actual = await get(`/rulesets/${rulesetId}`);
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
