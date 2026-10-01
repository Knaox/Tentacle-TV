// L'héritage du verdict de qualité, rejoué sur un vrai dépôt git jetable.
//
// Ce qui compte ici pour les livraisons séparées : une livraison webOS qui
// demande une version pousse un commit de bump (versions.json → webos,
// apps/tv-webos/package.json → version) SANS run de qualité. La livraison
// suivante — serveur ou webOS — vise ce commit : il doit hériter du verdict de
// son parent, sinon elle attendrait vingt minutes un run qui ne viendra pas.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { findQualityTarget } from '../quality-target.mjs';

let repo;
const initial = process.cwd();
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const write = (path, value) => {
  mkdirSync(join(repo, path, '..'), { recursive: true });
  writeFileSync(join(repo, path), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
};
const commit = (message) => {
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', message);
  return git('rev-parse', 'HEAD');
};

const VERSIONS = { desktop: '1.25.1', tv: '1.4.0', webos: '1.0.0', mobile: '1.10.0', server: '1.22.0', minServer: '1.22.0' };
const WEBOS_PKG = { name: '@tentacle-tv/tv-webos', version: '1.0.0', private: true, dependencies: { react: '^19.0.0' } };

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'quality-target-'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  write('versions.json', VERSIONS);
  write('apps/tv-webos/package.json', WEBOS_PKG);
  write('.github/workflows/webos.yml', 'name: Release webOS\n');
  write('changelogs/server-webos.md', '# Changelog\n');
  // findQualityTarget lit l'historique du répertoire courant.
  process.chdir(repo);
});

after(() => {
  process.chdir(initial);
  rmSync(repo, { recursive: true, force: true });
});

test('le bump d\'une livraison webOS hérite du verdict de son parent', () => {
  const verified = commit('feat : du code, contrôlé par quality.yml');
  write('versions.json', { ...VERSIONS, webos: '1.1.0' });
  write('apps/tv-webos/package.json', { ...WEBOS_PKG, version: '1.1.0' });
  const bump = commit('release(webos) : v1.1.0');

  const runs = new Map([[verified, 1]]);
  assert.equal(findQualityTarget(bump, (c) => runs.get(c) ?? 0), verified);
});

test('le bump du serveur hérite aussi, deux bumps d\'affilée compris', () => {
  const verified = commit('fix : contrôlé');
  write('versions.json', { ...VERSIONS, webos: '1.1.0', server: '1.22.1' });
  write('apps/backend/package.json', { name: '@tentacle-tv/backend', version: '1.22.0' });
  const withBackend = commit('chore : le package.json du backend apparaît');
  // Un package.json CRÉÉ n'est pas une retouche de version : pas d'héritage.
  assert.equal(findQualityTarget(withBackend, (c) => (c === verified ? 1 : 0)), withBackend);

  const verified2 = commit('fix : contrôlé à nouveau');
  write('versions.json', { ...VERSIONS, webos: '1.1.0', server: '1.22.2' });
  write('apps/backend/package.json', { name: '@tentacle-tv/backend', version: '1.22.2' });
  commit('release(server) : v1.22.2');
  write('versions.json', { ...VERSIONS, webos: '1.1.1', server: '1.22.2' });
  write('apps/tv-webos/package.json', { ...WEBOS_PKG, version: '1.1.1' });
  const second = commit('release(webos) : v1.1.1');
  assert.equal(findQualityTarget(second, (c) => (c === verified2 ? 1 : 0)), verified2);
});

test('un bump qui touche une dépendance n\'est plus neutre', () => {
  const verified = commit('fix : contrôlé');
  write('apps/tv-webos/package.json', { ...WEBOS_PKG, version: '1.2.0', dependencies: { react: '^19.1.0' } });
  const sneaky = commit('release(webos) : v1.2.0, et une dépendance au passage');
  assert.equal(findQualityTarget(sneaky, (c) => (c === verified ? 1 : 0)), sneaky);
});

test('un workflow ou des notes de version ne sont pas neutres : leur propre run fait foi', () => {
  const verified = commit('fix : contrôlé');
  write('.github/workflows/webos.yml', 'name: Release webOS\n# retouche\n');
  const workflow = commit('ci(webos) : retouche');
  assert.equal(findQualityTarget(workflow, (c) => (c === verified ? 1 : 0)), workflow);

  write('changelogs/server-webos.md', '# Changelog\n\n## [1.2.0]\n');
  const notes = commit('docs(changelogs) : server-webos 1.2.0');
  assert.equal(findQualityTarget(notes, (c) => (c === verified ? 1 : 0)), notes);
});

test('un run présent l\'emporte toujours, même rouge : on n\'hérite jamais par-dessus', () => {
  commit('fix : contrôlé');
  write('versions.json', { ...VERSIONS, webos: '1.3.0' });
  const bump = commit('release(webos) : v1.3.0');
  assert.equal(findQualityTarget(bump, (c) => (c === bump ? 1 : 0)), bump);
});
