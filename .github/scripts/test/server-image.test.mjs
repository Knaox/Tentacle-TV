// Le plan de l'image serveur : qui livre quoi, et ce qui refuse de partir.
// Les faits du registre sont posés à la main — ceux du 2026-10-01 d'abord :
// « :latest » et « :v1.22.0 » sont la même image, sans aucun label.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LABELS, PlanError, planServerImage, webosTag } from '../lib/server-image.mjs';

const IMAGE = 'ghcr.io/knaox/tentacle-tv';
const SHA = 'a'.repeat(40);
const D_1220 = `sha256:${'1'.repeat(64)}`;
const D_OTHER = `sha256:${'2'.repeat(64)}`;

/** L'état réel au 2026-10-01 : la production EST l'image de server.yml 1.22.0. */
const unlabeled1220 = { digest: D_1220, labels: {} };

const server = (channel, extra = {}) => ({
  mode: 'server', channel, image: IMAGE, sha: SHA, serverVersion: '1.22.1', webosVersion: '1.0.0', ...extra,
});
const webos = (channel, extra = {}) => ({
  mode: 'webos', channel, image: IMAGE, sha: SHA, serverVersion: '1.22.0', webosVersion: '1.1.0',
  minServer: '1.22.0', clientDir: 'tv-client-dist', ...extra,
});

test('serveur : le client LG vient de l\'image en service, épinglée — jamais du commit', () => {
  for (const channel of ['build', 'test', 'store']) {
    const plan = planServerImage(server(channel), { production: unlabeled1220 });
    assert.deepEqual(plan.contexts, [`tv-client-build=docker-image://${IMAGE}@${D_1220}`]);
  }
});

test('serveur : étiquettes, bascule et Release selon le cran', () => {
  const build = planServerImage(server('build'), { production: unlabeled1220 });
  assert.equal(build.push, false);
  assert.deepEqual(build.tags, []);
  assert.equal(build.release, null);
  assert.equal(build.expectLatest, '');

  const tested = planServerImage(server('test'), { production: unlabeled1220 });
  assert.deepEqual(tested.tags, ['v1.22.1']);
  assert.equal(tested.expectLatest, '', ':latest ne bouge pas au cran test');
  assert.equal(tested.release, null);

  const store = planServerImage(server('store'), { production: unlabeled1220 });
  assert.deepEqual(store.tags, ['v1.22.1', 'latest']);
  assert.equal(store.expectLatest, D_1220, 'la bascule vérifie que :latest n\'a pas bougé');
  assert.equal(store.release.tag, 'server-v1.22.1');
  assert.equal(store.release.changelog, 'changelogs/server.md');
  assert.equal(store.release.version, '1.22.1');
  assert.equal(store.release.latest, true);
});

test('serveur : un client non étiqueté est repris tel quel, et le label le dit', () => {
  const plan = planServerImage(server('store'), { production: unlabeled1220 });
  assert.equal(plan.clientVersion, '');
  assert.equal(plan.labels[LABELS.client], '');
  assert.equal(plan.labels[LABELS.version], '1.22.1');
  assert.equal(plan.labels[LABELS.revision], SHA);
  assert.match(plan.release.header.join('\n'), /non étiqueté/);
  assert.equal(plan.notices[0].level, 'notice');
});

test('serveur : le numéro du client en service se propage, et un écart avec versions.json avertit', () => {
  const production = { digest: D_OTHER, labels: { [LABELS.client]: '1.1.0', [LABELS.clientRevision]: 'b'.repeat(40) } };
  const same = planServerImage(server('store', { webosVersion: '1.1.0' }), { production });
  assert.equal(same.labels[LABELS.client], '1.1.0');
  assert.equal(same.labels[LABELS.clientRevision], 'b'.repeat(40));
  assert.deepEqual(same.notices, []);
  assert.match(same.release.header.join('\n'), /1\.1\.0, inchangé/);

  // webOS 1.2.0 livré au cran test seulement : le serveur ne le met PAS en service.
  const ahead = planServerImage(server('store', { webosVersion: '1.2.0' }), { production });
  assert.equal(ahead.labels[LABELS.client], '1.1.0');
  assert.equal(ahead.notices[0].level, 'warning');
});

test('serveur : sans image en service, rien ne part', () => {
  assert.throws(() => planServerImage(server('test'), { production: null }), PlanError);
});

test('webOS : le serveur n\'est pas reconstruit, le client vient du run', () => {
  const plan = planServerImage(webos('test'), { production: unlabeled1220, base: unlabeled1220 });
  assert.deepEqual(plan.contexts, [`server=docker-image://${IMAGE}@${D_1220}`, 'tv-client=tv-client-dist']);
  assert.equal(plan.serverVersion, '1.22.0');
  assert.equal(plan.clientVersion, '1.1.0');
  assert.equal(plan.labels[LABELS.client], '1.1.0');
  assert.equal(plan.labels[LABELS.clientRevision], SHA);
  assert.equal(LABELS.revision in plan.labels, false, 'la révision reste, héritée, celle du serveur');
});

test('webOS : cran test = étiquette dédiée seule ; store = dédiée + :latest + Release dédiée', () => {
  const build = planServerImage(webos('build'), { production: unlabeled1220, base: unlabeled1220 });
  assert.equal(build.push, false);
  assert.deepEqual(build.tags, []);

  const tested = planServerImage(webos('test'), { production: unlabeled1220, base: unlabeled1220 });
  assert.equal(webosTag('1.22.0', '1.1.0'), 'v1.22.0-webos-1.1.0');
  assert.deepEqual(tested.tags, ['v1.22.0-webos-1.1.0']);
  assert.equal(tested.expectLatest, '');
  assert.equal(tested.release, null);

  const store = planServerImage(webos('store'), { production: unlabeled1220, base: unlabeled1220 });
  assert.deepEqual(store.tags, ['v1.22.0-webos-1.1.0', 'latest']);
  assert.equal(store.expectLatest, D_1220);
  assert.equal(store.release.tag, 'server-v1.22.0-webos-1.1.0');
  assert.equal(store.release.changelog, 'changelogs/server-webos.md');
  assert.equal(store.release.version, '1.1.0', 'les notes dédiées sont rangées sous la version webOS');
  assert.equal(store.release.latest, false);
});

test('webOS au cran test : la base n\'a pas besoin d\'être en service', () => {
  // Serveur 1.22.0 publié au cran test seulement : :latest sert encore 1.21.0.
  const production = { digest: D_OTHER, labels: { [LABELS.version]: '1.21.0' } };
  const plan = planServerImage(webos('test'), { production, base: unlabeled1220 });
  assert.deepEqual(plan.tags, ['v1.22.0-webos-1.1.0']);
});

test('webOS au cran store : refus si la production n\'est pas déjà le serveur de versions.json', () => {
  const older = { digest: D_OTHER, labels: { [LABELS.version]: '1.21.0' } };
  assert.throws(() => planServerImage(webos('store'), { production: older, base: unlabeled1220 }),
    (e) => e instanceof PlanError && /1\.21\.0, pas 1\.22\.0/.test(e.message));
  // Ni label, ni même empreinte que :vS : on ne sait pas, donc on refuse.
  const unknown = { digest: D_OTHER, labels: {} };
  assert.throws(() => planServerImage(webos('store'), { production: unknown, base: unlabeled1220 }),
    (e) => e instanceof PlanError && /serveur inconnu/.test(e.message));
  assert.throws(() => planServerImage(webos('store'), { production: null, base: unlabeled1220 }), PlanError);
});

test('webOS au cran store : une production déjà reconstruite (labels) est reconnue', () => {
  const rebuilt = { digest: D_OTHER, labels: { [LABELS.version]: '1.22.0', [LABELS.client]: '1.0.1' } };
  const plan = planServerImage(webos('store'), { production: rebuilt, base: unlabeled1220 });
  assert.equal(plan.expectLatest, D_OTHER);
  assert.deepEqual(plan.contexts[0], `server=docker-image://${IMAGE}@${D_1220}`, 'toujours sur :vS, jamais empilé');
});

test('webOS : sans image du serveur de versions.json, rien ne part', () => {
  assert.throws(() => planServerImage(webos('test'), { production: unlabeled1220, base: null }),
    (e) => e instanceof PlanError && /:v1\.22\.0/.test(e.message));
});

test('webOS : un client qui exige un serveur plus récent est refusé avant tout build', () => {
  assert.throws(() => planServerImage(webos('test', { minServer: '1.23.0' }), { production: unlabeled1220, base: unlabeled1220 }),
    (e) => e instanceof PlanError && /≥ 1\.23\.0/.test(e.message));
  // Égal : c'est le cas normal.
  assert.doesNotThrow(() => planServerImage(webos('test', { minServer: '1.22.0' }), { production: unlabeled1220, base: unlabeled1220 }));
});

test('entrées illisibles : refus explicite', () => {
  const facts = { production: unlabeled1220, base: unlabeled1220 };
  assert.throws(() => planServerImage(server('store', { mode: 'docker' }), facts), PlanError);
  assert.throws(() => planServerImage(server('prod'), facts), PlanError);
  assert.throws(() => planServerImage(server('store', { sha: 'HEAD' }), facts), PlanError);
  assert.throws(() => planServerImage(server('store', { serverVersion: 'v1.22' }), facts), PlanError);
  assert.throws(() => planServerImage(webos('store', { webosVersion: '' }), facts), PlanError);
  assert.throws(() => planServerImage(webos('store', { minServer: undefined }), facts), PlanError);
});
