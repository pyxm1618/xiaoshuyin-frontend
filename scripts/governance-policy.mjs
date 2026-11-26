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
  if (/^(package\.json|bun\.lock|project\.config\.json|\.env\.example|\.gitignore|\.gitattributes|\.node-version)$/.test(path) ||
      /^scripts\/(?:build|engineering)\//.test(path)) return 'shared';
  if (/^(tsconfig\.json|AGENTS\.md|README\.md|specs\/README\.md|tests\/bootstrap\.test\.mjs)$/.test(path) ||
      /^\.specify\/|^\.agents\/skills\/|^\.github\/workflows\//.test(path) ||
      /^scripts\/(?:governance(?:-policy)?|upstream|verify-all|check-ruleset)\.mjs$/.test(path)) return 'governance';
  if (/^specs\/\d{3,}-fe-[a-z0-9-]+\//.test(path)) return 'planning';
  return 'unknown';
}

export function validateAuditAdmission(root, feature, readBase, expectedImpact) {
  const prefix = `specs/${feature}/`;
  const record = JSON.parse(readBase(prefix + 'audit1.json'));
  if (record.feature !== feature || record.role !== 'Plan AI 2' || record.decision !== 'PASS' ||
      typeof record.evidence !== 'string' || !record.evidence.trim() ||
      Object.keys(record.artifacts ?? {}).length !== planningFiles.length) {
    throw new Error(`Invalid Audit 1 admission: ${feature}`);
  }
  if (expectedImpact && record.authorityImpact !== expectedImpact) {
    throw new Error(`Audit 1 must be renewed for the Authority change: ${feature}`);
  }
  const spec = readBase(prefix + 'spec.md');
  const semantics = spec.match(/^\*\*Business Semantics\*\*: (NONE|CHANGED)$/m)?.[1];
  const assessment = record.semanticAssessment;
  if (!assessment || assessment.businessSemantics !== semantics ||
      typeof assessment.rationale !== 'string' || !assessment.rationale.trim() ||
      typeof assessment.evidence !== 'string' || !assessment.evidence.trim()) {
    throw new Error(`Audit 1 semantic assessment missing or inconsistent: ${feature}`);
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
