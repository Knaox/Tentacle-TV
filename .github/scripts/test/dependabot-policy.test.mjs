// Auto-fusion des PR de Dependabot : seulement ce qui est peu risqué et vert.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checksVerdict, ecosystemOf, judge, parseUpdatedDependencies } from '../lib/dependabot-policy.mjs';

const message = (...deps) => [
  'chore(deps): bump things',
  '',
  'Bumps x from 1.0.0 to 1.0.1.',
  '',
  '---',
  'updated-dependencies:',
  ...deps.flatMap(([name, type, update]) => [
    `- dependency-name: ${name}`,
    '  dependency-version: 1.0.1',
    `  dependency-type: ${type}`,
    `  update-type: version-update:semver-${update}`,
    '  dependency-group: minor-and-patch',
  ]),
  '...',
  '',
  'Signed-off-by: dependabot[bot] <support@github.com>',
].join('\n');

const pr = (deps, overrides = {}) => ({
  author: 'dependabot[bot]',
  branch: 'dependabot/npm_and_yarn/minor-and-patch-abc',
  files: ['pnpm-lock.yaml', 'apps/backend/package.json'],
  commits: [{ author: 'dependabot[bot]', message: message(...deps) }],
  ...overrides,
});

test('lit les dépendances d\'un groupe', () => {
  const deps = parseUpdatedDependencies(message(['fastify', 'direct:production', 'patch'], ['eslint', 'direct:development', 'minor']));
  assert.deepEqual(deps, [
    { name: 'fastify', type: 'direct:production', update: 'version-update:semver-patch' },
    { name: 'eslint', type: 'direct:development', update: 'version-update:semver-minor' },
  ]);
  assert.equal(parseUpdatedDependencies('chore: rien'), null);
});

test('un correctif passe, prod comprise', () => {
  assert.equal(judge(pr([['fastify', 'direct:production', 'patch'], ['ws', 'indirect', 'patch']])).merge, true);
});

test('une mineure ne passe qu\'en développement npm', () => {
  assert.equal(judge(pr([['eslint', 'direct:development', 'minor']])).merge, true);
  const refused = judge(pr([['fastify', 'direct:production', 'minor']]));
  assert.equal(refused.merge, false);
  assert.match(refused.reasons.join(), /mineure d'une dépendance de production/);
});

test('une majeure ne passe jamais, même d\'outillage', () => {
  assert.equal(judge(pr([['eslint', 'direct:development', 'major']])).merge, false);
});

test('une action passe en mineure, pas en majeure', () => {
  const actions = { branch: 'dependabot/github_actions/actions-abc', files: ['.github/workflows/quality.yml'] };
  assert.equal(judge(pr([['actions/checkout', 'direct:production', 'minor']], actions)).merge, true);
  assert.equal(judge(pr([['actions/checkout', 'direct:production', 'major']], actions)).merge, false);
});

test('un groupe passe seulement si chaque dépendance passe', () => {
  const verdict = judge(pr([['eslint', 'direct:development', 'patch'], ['react-router-dom', 'direct:production', 'minor']]));
  assert.equal(verdict.merge, false);
});

test('les paquets réservés ne fusionnent jamais seuls', () => {
  for (const name of ['electron', 'koffi', 'react']) {
    assert.equal(judge(pr([[name, 'direct:production', 'patch']])).merge, false, name);
  }
});

test('refuse une PR qui n\'est pas purement de Dependabot', () => {
  assert.equal(judge(pr([['ws', 'indirect', 'patch']], { author: 'someone' })).merge, false);
  const extra = { commits: [{ author: 'dependabot[bot]', message: message(['ws', 'indirect', 'patch']) }, { author: 'Knaox', message: 'fix' }] };
  assert.equal(judge(pr([], extra)).merge, false);
  assert.equal(judge(pr([['ws', 'indirect', 'patch']], { files: ['pnpm-lock.yaml', 'apps/backend/src/index.ts'] })).merge, false);
  assert.equal(judge(pr([['ws', 'indirect', 'patch']], { branch: 'feature/x' })).merge, false);
});

test('écosystème lu sur la branche', () => {
  assert.equal(ecosystemOf('dependabot/npm_and_yarn/x'), 'npm');
  assert.equal(ecosystemOf('dependabot/docker/x'), 'docker');
  assert.equal(ecosystemOf('main'), null);
});

test('les checks : tous finis et verts, le juge exclu, un minimum exigé', () => {
  const run = (name, status = 'completed', conclusion = 'success') => ({ name, status, conclusion });
  const four = [run('Typecheck et tests'), run('gitleaks'), run('pnpm audit'), run('Dependency review')];
  assert.equal(checksVerdict([...four, run('Auto-fusion', 'in_progress', null)], 'Auto-fusion'), 'green');
  assert.equal(checksVerdict([...four, run('CodeQL', 'in_progress', null)], 'Auto-fusion'), 'pending');
  assert.equal(checksVerdict([...four.slice(1), run('Typecheck et tests', 'completed', 'failure')], 'Auto-fusion'), 'red');
  assert.equal(checksVerdict(four.slice(0, 2), 'Auto-fusion'), 'pending');
});
