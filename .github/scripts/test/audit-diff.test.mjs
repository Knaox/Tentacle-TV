// Verdict de pnpm audit : une PR ne paie que ce qu'elle ajoute.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advisoriesAtLeast, newAdvisories } from '../lib/audit-diff.mjs';

const advisory = (id, module, severity, version = '1.0.0') => ({
  id: Number(id.replace(/\D/g, '')) || 1,
  github_advisory_id: id,
  module_name: module,
  severity,
  title: `${module} ${severity}`,
  patched_versions: '>=9.9.9',
  findings: [{ version, paths: [`apps__x>${module}`] }],
});
const report = (...list) => ({ advisories: Object.fromEntries(list.map((a, i) => [String(i), a])) });

test('le seuil retient high et critical, pas moderate', () => {
  const found = advisoriesAtLeast(
    report(advisory('GHSA-a', 'ws', 'moderate'), advisory('GHSA-b', 'tar', 'high'), advisory('GHSA-c', 'vitest', 'critical')),
    'high',
  );
  assert.deepEqual([...found.values()].map((a) => a.module).sort(), ['tar', 'vitest']);
});

test('sans base, tout avis au seuil compte (tâche hebdomadaire)', () => {
  const added = newAdvisories(report(advisory('GHSA-b', 'tar', 'high')), null, 'high');
  assert.equal(added.length, 1);
});

test('avec base, un avis déjà présent ne compte pas', () => {
  const base = report(advisory('GHSA-b', 'tar', 'high', '7.5.13'));
  const head = report(advisory('GHSA-b', 'tar', 'high', '7.5.16'), advisory('GHSA-d', 'undici', 'critical'));
  assert.deepEqual(newAdvisories(head, base, 'high').map((a) => a.id), ['GHSA-d']);
});

test('le même avis sur un autre paquet est nouveau', () => {
  const base = report(advisory('GHSA-b', 'tar', 'high'));
  const head = report(advisory('GHSA-b', 'tar', 'high'), advisory('GHSA-b', 'tar-fs', 'high'));
  assert.deepEqual(newAdvisories(head, base, 'high').map((a) => a.module), ['tar-fs']);
});

test('un avis corrigé par la branche ne fait pas échouer', () => {
  const base = report(advisory('GHSA-b', 'tar', 'high'));
  assert.equal(newAdvisories(report(), base, 'high').length, 0);
});

test("un rapport d'erreur n'est jamais « rien trouvé »", () => {
  assert.throws(() => advisoriesAtLeast({ error: { code: 'ERR_PNPM_AUDIT_BAD_RESPONSE' } }, 'high'), /illisible/);
  assert.throws(() => advisoriesAtLeast(report(), 'severe'), /niveau inconnu/);
});
