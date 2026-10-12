// Le plan de Tentacle Server pour Windows : quel serveur, quel client LG, où
// part la soumission — et ce qui refuse de partir. Faits du registre posés à
// la main, sur le modèle de server-image.test.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LABELS, PlanError, liveServerVersion } from '../lib/server-image.mjs';
import { WINDOWS_NOTES, planWindowsPackage, storeTarget, windowsFollowUp, windowsTag } from '../lib/server-windows.mjs';

const IMAGE = 'ghcr.io/knaox/tentacle-tv';
const SHA = 'a'.repeat(40);
const REV = 'b'.repeat(40);
const D_BASE = `sha256:${'1'.repeat(64)}`;
const D_LATEST = `sha256:${'2'.repeat(64)}`;

/** « :v1.25.1 » tel que server.yml l'a publié, avec le client LG 1.0.0. */
const base = { digest: D_BASE, labels: { [LABELS.version]: '1.25.1', [LABELS.revision]: REV, [LABELS.client]: '1.0.0' } };
/** La production : le même serveur, reconstruit par webOS avec le client 1.1.0. */
const latestSame = { digest: D_LATEST, labels: { [LABELS.version]: '1.25.1', [LABELS.client]: '1.1.0' } };
/** La production sur un AUTRE serveur que celui de versions.json. */
const latestOther = { digest: D_LATEST, labels: { [LABELS.version]: '1.25.0', [LABELS.client]: '1.1.0' } };

const params = (channel, extra = {}) => ({
  channel, image: IMAGE, sha: SHA, serverVersion: '1.25.1', minServer: '1.23.0', ...extra,
});

test('la version de l\'app EST celle du serveur : paquet S.0, tag server-windows-vS', () => {
  const plan = planWindowsPackage(params('build'), { production: latestSame, base, drift: [] });
  assert.equal(plan.serverVersion, '1.25.1');
  assert.equal(plan.windowsVersion, '1.25.1');
  assert.equal(plan.msixVersion, '1.25.1.0');
  assert.equal(plan.tag, 'server-windows-v1.25.1');
  assert.equal(windowsTag('2.3.4'), 'server-windows-v2.3.4');
});

test('une version demandée doit être celle du serveur : rien ne se bumpe ici', () => {
  const same = planWindowsPackage(params('test', { expectedVersion: '1.25.1' }), { production: latestSame, base, drift: [] });
  assert.equal(same.msixVersion, '1.25.1.0');
  assert.equal(planWindowsPackage(params('test', { expectedVersion: '' }), { production: latestSame, base, drift: [] })
    .windowsVersion, '1.25.1');
  assert.throws(() => planWindowsPackage(params('test', { expectedVersion: '1.27.0' }), { production: latestSame, base }),
    (e) => e instanceof PlanError && /1\.27\.0/.test(e.message) && /server vaut 1\.25\.1/.test(e.message));
  assert.throws(() => planWindowsPackage(params('test', { expectedVersion: 'v1.25' }), { production: latestSame, base }),
    (e) => e instanceof PlanError && /illisible/.test(e.message));
});

test('server.yml n\'enchaîne l\'app Windows qu\'aux crans test et store', () => {
  assert.equal(windowsFollowUp({ channel: 'test', windows: true }), true);
  assert.equal(windowsFollowUp({ channel: 'store', windows: true }), true);
  for (const channel of ['build', 'test', 'store', 'dev', '']) {
    assert.equal(windowsFollowUp({ channel, windows: false }), false);
  }
  assert.throws(() => windowsFollowUp({ channel: 'build', windows: true }), (e) => e instanceof PlanError && /build/.test(e.message));
  assert.throws(() => windowsFollowUp({ channel: 'dev', windows: true }), (e) => e instanceof PlanError && /:dev/.test(e.message));
  assert.throws(() => windowsFollowUp({ channel: '', windows: true }), PlanError);
});

test('le client LG est celui en service quand la production sert ce serveur, épinglé', () => {
  for (const channel of ['build', 'test', 'store']) {
    const plan = planWindowsPackage(params(channel), { production: latestSame, base, drift: [] });
    assert.equal(plan.clientImage, `${IMAGE}@${D_LATEST}`);
    assert.equal(plan.clientFrom, 'latest');
    assert.equal(plan.clientVersion, '1.1.0');
    assert.deepEqual(plan.notices, []);
  }
});

test('production sur un autre serveur : le client vient de « :vS », et le store refuse', () => {
  const tested = planWindowsPackage(params('test'), { production: latestOther, base, drift: [] });
  assert.equal(tested.clientImage, `${IMAGE}@${D_BASE}`);
  assert.equal(tested.clientFrom, 'v1.25.1');
  assert.equal(tested.clientVersion, '1.0.0');
  assert.ok(tested.notices.some((n) => /1\.25\.0/.test(n.text)));

  assert.throws(() => planWindowsPackage(params('store'), { production: latestOther, base, drift: [] }),
    (e) => e instanceof PlanError && /serveur 1\.25\.0, pas 1\.25\.1/.test(e.message));
  assert.throws(() => planWindowsPackage(params('store'), { production: null, base, drift: [] }), PlanError);
});

test('une production d\'avant les labels se reconnaît à son empreinte', () => {
  const unlabeled = { digest: D_BASE, labels: {} };
  assert.equal(liveServerVersion(unlabeled, base, '1.25.1'), '1.25.1');
  assert.equal(liveServerVersion({ digest: D_LATEST, labels: {} }, base, '1.25.1'), '');
  assert.equal(liveServerVersion(null, base, '1.25.1'), '');
  const plan = planWindowsPackage(params('store'), { production: unlabeled, base, drift: [] });
  assert.equal(plan.clientFrom, 'latest');
});

test('un serveur jamais publié, ou plus ancien que minServer, ne part à aucun cran', () => {
  for (const channel of ['build', 'test', 'store']) {
    assert.throws(() => planWindowsPackage(params(channel), { production: latestSame, base: null }),
      (e) => e instanceof PlanError && /v1\.25\.1/.test(e.message));
    assert.throws(() => planWindowsPackage(params(channel, { minServer: '1.26.0' }), { production: latestSame, base }),
      (e) => e instanceof PlanError && /1\.26\.0/.test(e.message));
  }
});

test('ni cran dev, ni version illisible', () => {
  assert.throws(() => planWindowsPackage(params('dev'), { production: latestSame, base }), PlanError);
  assert.throws(() => planWindowsPackage(params('test', { serverVersion: undefined }), { production: latestSame, base }),
    (e) => /versions\.json → server illisible/.test(e.message));
  assert.throws(() => planWindowsPackage(params('test', { sha: 'abc' }), { production: latestSame, base }), PlanError);
});

test('le serveur du commit qui s\'écarte de « :vS » avertit, sans bloquer', () => {
  const drift = ['apps/backend/src/index.ts', 'apps/web/src/App.tsx', 'packages/shared/src/a.ts',
    'packages/shared/src/b.ts', 'packages/shared/src/c.ts', 'packages/shared/src/d.ts'];
  const plan = planWindowsPackage(params('store'), { production: latestSame, base, drift });
  const warning = plan.notices.find((n) => n.level === 'warning');
  assert.match(warning.text, /6 fichier\(s\)/);
  assert.match(warning.text, /et 1 autre\(s\)/);
  assert.match(warning.text, /bbbbbbbb/);

  const unknown = planWindowsPackage(params('test'), { production: latestSame, base, drift: null });
  assert.ok(unknown.notices.some((n) => n.level === 'notice' && /pas lisible/.test(n.text)));

  const noRevision = { ...base, labels: { [LABELS.version]: '1.25.1' } };
  const old = planWindowsPackage(params('test'), { production: latestSame, base: noRevision, drift: null });
  assert.ok(old.notices.some((n) => /ne dit pas de quel commit/.test(n.text)));
});

test('soumission : rien au cran build, un vol au cran test, la fiche au cran store', () => {
  assert.equal(storeTarget({ channel: 'build' }), null);
  assert.equal(storeTarget({ channel: 'build', storeId: '', flightId: '' }), null);
  assert.deepEqual(storeTarget({ channel: 'store', storeId: '9NABCDEF1234', flightId: 'ignoré' }),
    { storeId: '9NABCDEF1234', flightId: '' });
  assert.deepEqual(storeTarget({ channel: 'test', storeId: '9NABCDEF1234', flightId: '43e448df-97c9-4a43-a0bc-2a445e736bcd' }),
    { storeId: '9NABCDEF1234', flightId: '43e448df-97c9-4a43-a0bc-2a445e736bcd' });
});

test('soumission : une variable absente ou illisible arrête le run et dit laquelle', () => {
  for (const channel of ['test', 'store']) {
    assert.throws(() => storeTarget({ channel, storeId: '' }), (e) => /SERVER_WINDOWS_STORE_ID n'est pas posée/.test(e.message));
  }
  assert.throws(() => storeTarget({ channel: 'store', storeId: '9nkhl0t84245' }), /illisible/);
  assert.throws(() => storeTarget({ channel: 'test', storeId: '9NABCDEF1234' }),
    (e) => /SERVER_WINDOWS_FLIGHT_ID n'est pas posée/.test(e.message));
  assert.throws(() => storeTarget({ channel: 'test', storeId: '9NABCDEF1234', flightId: 'a b' }), /illisible/);
  assert.throws(() => storeTarget({ channel: 'dev', storeId: '9NABCDEF1234' }), PlanError);
});

// ── Le câblage des workflows : un seul run, les notes du serveur ────────────
// Lu en texte (zéro dépendance ici, pas de parseur YAML) : ce sont les
// invariants que la décision de Damien (2026-10-12) ne doit jamais perdre.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path) => readFileSync(`${ROOT}${path}`, 'utf8');

test('les notes de l\'app Windows sont celles du serveur, un seul texte', () => {
  assert.equal(WINDOWS_NOTES, 'changelogs/server.md');
  assert.equal(existsSync(`${ROOT}changelogs/server-windows.md`), false, 'plus de changelog à part pour l\'app');
  assert.doesNotMatch(read('changelogs/server.md'), /^##\s*\[win-/m, 'aucun bloc par canal dans server.md');
  for (const wf of ['server.yml', 'server-windows.yml']) {
    const yml = read(`.github/workflows/${wf}`);
    assert.doesNotMatch(yml, /changelogs\/server-windows\.md/, `${wf} ne lit plus changelogs/server-windows.md`);
    assert.match(yml, /--changelog changelogs\/server\.md --version "[^"]+"[\s\\]*--check msstore/,
      `${wf} mesure les notes du serveur contre la limite du Microsoft Store`);
  }
  assert.match(read('.github/workflows/server-windows.yml'), /CHANGELOG: changelogs\/server\.md\n\s*CHANNEL: ""/);
});

test('un seul run : server.yml APPELLE server-windows.yml après l\'image, sans dispatch', () => {
  const server = read('.github/workflows/server.yml');
  const job = server.slice(server.indexOf('\n  windows:\n'));
  assert.match(job, /needs: \[prepare, image\]/);
  assert.match(job, /if: needs\.prepare\.outputs\.windows == 'true'/);
  assert.match(job, /uses: \.\/\.github\/workflows\/server-windows\.yml/);
  assert.match(job, /secrets: inherit/);
  assert.match(job, /sha: \$\{\{ needs\.prepare\.outputs\.sha \}\}/);
  assert.doesNotMatch(server, /gh workflow run|actions: write/);

  const windows = read('.github/workflows/server-windows.yml');
  const call = windows.slice(windows.indexOf('  workflow_call:'), windows.indexOf('\njobs:'));
  for (const input of ['channel', 'version', 'sha']) assert.match(call, new RegExp(`\n      ${input}:\n`));
  assert.match(windows, /\n  workflow_dispatch:\n/, 'relivrer l\'app seule reste possible');
  // Appelé, une concurrence de WORKFLOW s'ajouterait à celle de server.yml.
  assert.doesNotMatch(windows, /^concurrency:/m);
  // Plus de bump : la version, c'est server.yml qui l'écrit.
  assert.doesNotMatch(windows, /bump-version\.mjs|push-main/);
});
