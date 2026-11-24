import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const engineeringApproval = '.specify/engineering-authority-approval.json';
export const planningFiles = ['spec.md', 'plan.md', 'checklist.md', 'tasks.md', 'analyze.md'];
export const digest = (text) => createHash('sha256').update(text).digest('hex');
export const planDigest = (name, text) =>
  digest(name === 'tasks.md' ? text.replace(/^- \[[xX]\](?= T\d{3,}\b)/gm, '- [ ]') : text);

export function pathClass(path) {
  if (/^(apps\/miniprogram\/|packages\/(?!generated\/)|tests\/(?!bootstrap\.test\.mjs$))/.test(path)) return 'implementation';
  if (/^(package\.json|bun\.lock|tsconfig\.json|project\.config\.json|\.env\.example|\.gitignore|\.gitattributes|\.node-version)$/.test(path) ||
      /^scripts\/(?:build|engineering)\//.test(path)) return 'shared';
  if (/^(AGENTS\.md|README\.md|specs\/README\.md|tests\/bootstrap\.test\.mjs)$/.test(path) ||
      /^\.specify\/|^\.agents\/skills\/|^\.github\/workflows\//.test(path) ||
      /^scripts\/(?:governance(?:-policy)?|upstream|verify-all|check-ruleset)\.mjs$/.test(path)) return 'governance';
  if (/^specs\/\d{3,}-fe-[a-z0-9-]+\//.test(path)) return 'planning';
  return 'unknown';
}

export function validateAuditAdmission(root, feature, readBase) {
  const prefix = `specs/${feature}/`;
  const record = JSON.parse(readBase(prefix + 'audit1.json'));
  if (record.feature !== feature || record.role !== 'Plan AI 2' || record.decision !== 'PASS' ||
      typeof record.evidence !== 'string' || !record.evidence.trim() ||
      Object.keys(record.artifacts ?? {}).length !== planningFiles.length) {
    throw new Error(`Invalid Audit 1 admission: ${feature}`);
  }
  for (const name of planningFiles) {
    const committed = readBase(prefix + name);
    const current = readFileSync(join(root, prefix, name), 'utf8');
    const hash = planDigest(name, committed);
    if (!committed.trim() || record.artifacts[name] !== hash || planDigest(name, current) !== hash) {
      throw new Error(`Audit 1 planning artifact mismatch: ${prefix + name}`);
    }
  }
}
