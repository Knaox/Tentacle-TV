// Lectures « en ligne » du veilleur : versions, fiches publiques, rapports Play.
// Tout est hors réseau : les fiches sont des extraits réels figés dans fixtures/.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadNotes } from '../lib/changelog.mjs';
import { productionVersions, TV_VERSION_CODE_BASE } from '../lib/play-reporting.mjs';
import {
  decodeEntities, extractMsStoreNotes, extractPlayWhatsNew, matchNotesVersion, normalizeNotes,
} from '../lib/store-listings.mjs';
import { changelogVersions, compareVersions, isVersion, maxVersion, minVersion } from '../lib/versions.mjs';

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

test('versions : forme exacte, comparaison numérique, extrêmes', () => {
  assert.ok(isVersion('1.24.0'));
  for (const bad of ['1.24', '1.24.0-r1', 'v1.24.0', ' 1.24.0', null, 124]) assert.equal(isVersion(bad), false);
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0, '10 > 9 en numérique, pas en texte');
  assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
  assert.equal(maxVersion(['1.8.1', 'x', '1.10.0', null, '1.9.0']), '1.10.0');
  assert.equal(minVersion(['1.9.0', '1.8.1']), '1.8.1');
  assert.equal(maxVersion([]), null);
});

test('versions : un changelog se lit de la plus haute à la plus basse, canaux compris', () => {
  const md = '## [1.8.1]\n## [ios-1.8.1]\n## [win-1.10.0]\n## [1.9.0]\n### FR\n';
  assert.deepEqual(changelogVersions(md), ['1.10.0', '1.9.0', '1.8.1']);
});

test('fiche Play : le bloc « What’s new » réel se lit en texte brut', () => {
  const text = extractPlayWhatsNew(readFileSync(fixture('play-whatsnew.html'), 'utf8'));
  assert.ok(text.startsWith("• Search that suggests: Tentacle's engine"));
  assert.ok(text.includes('\n• Library:'), 'les <br> redeviennent des retours à la ligne');
  assert.equal(extractPlayWhatsNew('<html>autre chose</html>'), null);
});

test('fiche Play : la version en ligne est le bloc dont les notes Play sont affichées', () => {
  const changelog = fixture('changelog-mobile.md');
  const shown = extractPlayWhatsNew(readFileSync(fixture('play-whatsnew.html'), 'utf8'));
  const versions = changelogVersions(readFileSync(changelog, 'utf8'));
  assert.deepEqual(versions, ['1.9.0', '1.8.2', '1.8.1']);
  const live = matchNotesVersion(shown, versions, (version) => loadNotes({ changelog, version, format: 'play' })?.en);
  assert.equal(live, '1.8.1', 'la 1.9.0, plus haute, est en piste fermée : elle ne doit pas sortir');
});

test('vitrine Microsoft : ses notes désignent la 1.24.0, pas la 1.23.0', () => {
  const changelog = fixture('changelog-desktop.md');
  const shown = extractMsStoreNotes(JSON.parse(readFileSync(fixture('ms-store.json'), 'utf8')));
  const notesFor = (version) => loadNotes({ changelog, channel: 'win', version, format: 'msstore' })?.en;
  assert.equal(matchNotesVersion(shown, ['1.24.0', '1.23.0'], notesFor), '1.24.0');
  assert.equal(matchNotesVersion(shown, ['1.23.0'], notesFor), null, 'aucun bloc ne correspond : inconnu');
  assert.equal(extractMsStoreNotes({ Payload: { Notes: [] } }), null);
  assert.equal(extractMsStoreNotes(null), null);
});

test('notes : les retouches typographiques des boutiques ne cassent pas la correspondance', () => {
  assert.equal(normalizeNotes('It’s  “new”\n• ok'), normalizeNotes('it\'s "new" • OK'));
  assert.equal(decodeEntities('Tentacle&#39;s &amp; &#x2019; &quot;x&quot;'), 'Tentacle\'s & ’ "x"');
  assert.equal(matchNotesVersion('', ['1.0.0'], () => ''), null, 'une fiche vide ne prouve rien');
});

test('rapports Play : production seule, téléphone et TV séparés par le versionCode', () => {
  const tracks = [
    {
      type: 'PRODUCTION',
      displayName: 'Production',
      servingReleases: [
        { displayName: '1.8.1', versionCodes: ['1400000'] },
        { displayName: '1.3.1', versionCodes: [String(TV_VERSION_CODE_BASE + 1400001)] },
      ],
    },
    { type: 'CLOSED_TESTING', displayName: 'Alpha', servingReleases: [{ displayName: '1.9.0', versionCodes: ['1500000'] }] },
    { type: 'CLOSED_TESTING', displayName: 'tv:Alpha', servingReleases: [{ displayName: '1.4.0', versionCodes: [String(TV_VERSION_CODE_BASE + 5)] }] },
  ];
  assert.deepEqual(productionVersions(tracks), { phone: '1.8.1', tv: '1.3.1' });
});

test('rapports Play : un nom sans version ou des codes mêlés sont ignorés, jamais devinés', () => {
  const tracks = [
    {
      type: 'PRODUCTION',
      servingReleases: [
        { displayName: 'Release sans numéro', versionCodes: ['1'] },
        { displayName: '9.9.9', versionCodes: ['1', String(TV_VERSION_CODE_BASE + 1)] },
        { displayName: '1400123 (1.8.1)', versionCodes: ['1400123'] },
      ],
    },
  ];
  assert.deepEqual(productionVersions(tracks), { phone: '1.8.1', tv: null });
  assert.deepEqual(productionVersions([]), { phone: null, tv: null });
  assert.deepEqual(productionVersions(undefined), { phone: null, tv: null });
});
