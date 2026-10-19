// Le contrôle avant publication : rien ne part chez Play ni chez Apple sous un
// autre numéro, avec un autre binaire ou les notes d'une autre version.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ascNotesProblems, ascSubmissionProblems, normalizeNotes, playReleaseProblems, playReplacedReleases,
} from '../lib/release-check.mjs';

const NOTES = [{ language: 'fr-FR', text: '• Bannière en 16:9' }, { language: 'en-US', text: '• 16:9 banner' }];

const playRelease = (over = {}) => ({
  name: '1.20.0', versionCodes: ['2001472757'], status: 'completed',
  releaseNotes: [{ language: 'fr-FR', text: '• Bannière en 16:9\n' }, { language: 'en-US', text: '• 16:9 banner' }],
  ...over,
});

const playInput = (trackData, over = {}) => ({
  track: 'tv:internal', trackData, version: '1.20.0', versionCodes: ['2001472757'], notes: NOTES,
  productionVersion: '1.10.1', toProduction: false, ...over,
});

test('Play : la release voulue, seule sur sa piste, passe le contrôle', () => {
  assert.deepEqual(playReleaseProblems(playInput({ releases: [playRelease()] })), []);
});

test('Play : un autre nom, un autre binaire ou d’autres notes refusent la publication', () => {
  const problems = playReleaseProblems(playInput({
    releases: [playRelease({ name: '1.10.2', versionCodes: ['2001461095'], releaseNotes: [{ language: 'fr-FR', text: 'ancien' }] })],
  }));
  assert.ok(problems.some((p) => p.includes('« 1.10.2 » au lieu de « 1.20.0 »')));
  assert.ok(problems.some((p) => p.includes('versionCode 2001461095 au lieu de 2001472757')));
  assert.ok(problems.some((p) => p.includes('notes fr-FR différentes')));
  assert.ok(problems.some((p) => p.includes('notes en-US absentes')));
});

test('Play : un brouillon resté à côté de la release est signalé', () => {
  const problems = playReleaseProblems(playInput({ releases: [playRelease(), { name: '1.10.2', status: 'draft', versionCodes: ['1'] }] }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /2 releases au lieu d'une seule/);
});

test('Play : jamais une production qui recule', () => {
  const input = playInput({ releases: [playRelease({ name: '1.9.0' })] }, {
    track: 'tv:production', version: '1.9.0', productionVersion: '1.10.1', toProduction: true,
  });
  assert.ok(playReleaseProblems(input).some((p) => p.includes('la production sert déjà 1.10.1')));
  // Une piste de test peut porter une version plus ancienne que la production.
  assert.ok(!playReleaseProblems({ ...input, toProduction: false }).some((p) => p.includes('production sert')));
});

test('Play : ce que la réécriture d’une piste remplace — tout sauf la version livrée', () => {
  const replaced = playReplacedReleases({ releases: [playRelease(), { name: '1.10.2', status: 'draft' }] }, '1.20.0');
  assert.deepEqual(replaced.map((r) => r.name), ['1.10.2']);
  assert.deepEqual(playReplacedReleases(null, '1.20.0'), []);
});

const ver = (versionString, platform = 'TV_OS') => ({ id: 'v1', attributes: { versionString, platform } });
const build = (id, number, processingState = 'VALID', expired = false) => ({ id, attributes: { version: number, processingState, expired } });
const train = (version, platform = 'TV_OS') => ({ type: 'preReleaseVersions', attributes: { version, platform } });
const locs = (fr, en) => [
  { attributes: { locale: 'fr-FR', whatsNew: fr } },
  { attributes: { locale: 'en-US', whatsNew: en } },
];
const ASC_NOTES = [['fr-FR', '• Bannière en 16:9'], ['en-US', '• 16:9 banner']];

const ascInput = (over = {}) => ({
  version: '1.20.0', platform: 'TV_OS', ver: ver('1.20.0'), build: build('b2', '1472757'),
  preRelease: train('1.20.0'), expectedBuildId: 'b2', localizations: locs('• Bannière en 16:9\r\n', '• 16:9 banner'),
  expectedNotes: ASC_NOTES, ...over,
});

test('App Store : la bonne version, le bon build, les bonnes notes passent le contrôle', () => {
  assert.deepEqual(ascSubmissionProblems(ascInput()), []);
});

test('App Store : une 1.10.2 ouverte jamais soumise ne part jamais sous son numéro ni avec son build', () => {
  const problems = ascSubmissionProblems(ascInput({
    ver: ver('1.10.2'), build: build('b1', '1461095'), preRelease: train('1.10.2'),
    localizations: locs('Notes de la 1.10.2', 'Notes 1.10.2'),
  }));
  assert.ok(problems.some((p) => p.includes('« 1.10.2 » au lieu de « 1.20.0 »')));
  assert.ok(problems.some((p) => p.includes('au lieu du dernier build testé')));
  assert.ok(problems.some((p) => p.includes('build de 1.10.2, pas de 1.20.0')));
  assert.equal(problems.filter((p) => p.startsWith('« Nouveautés »')).length, 2);
});

test('App Store : un build d’une autre plateforme, pas traité, expiré, ou absent est refusé', () => {
  assert.ok(ascSubmissionProblems(ascInput({ preRelease: train('1.20.0', 'IOS') })).some((p) => p.includes('build IOS, pas TV_OS')));
  assert.ok(ascSubmissionProblems(ascInput({ build: build('b2', '1472757', 'PROCESSING') })).some((p) => p.includes('« PROCESSING »')));
  assert.ok(ascSubmissionProblems(ascInput({ build: build('b2', '1472757', 'VALID', true) })).some((p) => p.includes('a expiré')));
  assert.ok(ascSubmissionProblems(ascInput({ build: null })).some((p) => p.includes('aucun build rattaché')));
  assert.ok(ascSubmissionProblems(ascInput({ preRelease: null })).some((p) => p.includes('train TestFlight illisible')));
});

test('App Store : les « Nouveautés » se comparent sans les fins de ligne ni les blancs de bord', () => {
  assert.deepEqual(ascNotesProblems(locs('  • Bannière en 16:9  \n', '• 16:9 banner'), ASC_NOTES, '1.20.0'), []);
  assert.equal(ascNotesProblems([], ASC_NOTES, '1.20.0').length, 2);
  // Sans notes attendues (toute première version), rien à contrôler.
  assert.deepEqual(ascNotesProblems(locs('x', 'y'), [], '1.20.0'), []);
  assert.equal(normalizeNotes('a  \r\nb\n\n'), 'a\nb');
});
