// Le pré-contrôle de la reprise : ce qu'il y a VRAIMENT à reprendre au cran store.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestTestedBuild } from '../lib/asc-api.mjs';
import { TV_VERSION_CODE_BASE } from '../lib/play-reporting.mjs';
import {
  ascPromoteVerdict, playPromoteVerdict, promotableVersionCodes, releaseVersion,
} from '../lib/promote.mjs';

const ascVersion = (appVersionState) => ({ id: 'v1', attributes: { appVersionState } });

const tested = (version) => ({ id: `b${version}`, attributes: { version: String(version), processingState: 'VALID' } });

test('App Store : sans build TestFlight traité, la cible se construit', () => {
  assert.equal(ascPromoteVerdict(null, null).plan, 'build');
  // Le cas du 2026-09-29 : la version existait (les notes l'avaient créée), sans build.
  assert.equal(ascPromoteVerdict(ascVersion('PREPARE_FOR_SUBMISSION'), null).plan, 'build');
});

test('App Store : un build TestFlight se reprend, même sans version App Store', () => {
  // Le cran test n'ouvre plus de version : seul le train TestFlight existe.
  assert.equal(ascPromoteVerdict(null, tested(1450000)).plan, 'promote');
  assert.equal(ascPromoteVerdict(ascVersion('PREPARE_FOR_SUBMISSION'), tested(1450000)).plan, 'promote');
});

test('App Store : une version déjà soumise ou en vente se reprend (run rejoué)', () => {
  assert.equal(ascPromoteVerdict(ascVersion('WAITING_FOR_REVIEW'), null).plan, 'promote');
  assert.equal(ascPromoteVerdict({ id: 'v1', attributes: { appStoreState: 'READY_FOR_SALE' } }, null).plan, 'promote');
});

test('App Store : le build repris est le dernier TRAITÉ, jamais un expiré ni un en cours', () => {
  const build = (version, processingState, expired = false) =>
    ({ id: `b${version}`, attributes: { version: String(version), processingState, expired } });
  const picked = latestTestedBuild([
    build(1400000, 'VALID'),
    build(1450000, 'VALID'),
    build(1460000, 'PROCESSING'),
    build(1470000, 'VALID', true),
    build(1300000, 'VALID'),
  ]);
  assert.equal(picked.id, 'b1450000');
  assert.equal(latestTestedBuild([build(1, 'INVALID')]), null);
  assert.equal(latestTestedBuild(undefined), null);
});

test('Play : seule une piste de TEST qui sert la version, au bon form factor, se reprend', () => {
  const tracks = [
    { type: 'PRODUCTION', displayName: 'Production', servingReleases: [{ displayName: '1.10.0', versionCodes: ['1500000'] }] },
    { type: 'CLOSED_TESTING', displayName: 'Alpha', servingReleases: [{ displayName: '1.8.1', versionCodes: ['1400000'] }] },
    { type: 'CLOSED_TESTING', displayName: 'tv:Alpha', servingReleases: [{ displayName: '1.4.0', versionCodes: [String(TV_VERSION_CODE_BASE + 5)] }] },
  ];
  assert.equal(playPromoteVerdict(tracks, '1.4.0', 'tv').plan, 'promote');
  // La production ne compte pas : ce n'est pas une piste d'où l'on promeut.
  assert.equal(playPromoteVerdict(tracks, '1.10.0', 'phone').plan, 'build');
  // Une release TV ne vaut pas pour le téléphone, ni l'inverse.
  assert.equal(playPromoteVerdict(tracks, '1.4.0', 'phone').plan, 'build');
  assert.equal(playPromoteVerdict(tracks, '1.8.1', 'tv').plan, 'build');
  assert.equal(playPromoteVerdict(tracks, '1.8.1', 'phone').plan, 'promote');
  assert.equal(playPromoteVerdict(undefined, '1.8.1', 'phone').plan, 'build');
});

test('Play : la piste SOURCE donnée, elle seule compte (la reprise part de la piste interne)', () => {
  const tv = (n) => String(TV_VERSION_CODE_BASE + n);
  const tracks = [
    { type: 'CLOSED_TESTING', displayName: 'tv:Alpha', servingReleases: [{ displayName: '1.20.0', versionCodes: [tv(5)] }] },
    { type: 'INTERNAL', displayName: 'tv:internal', servingReleases: [{ displayName: '1.11.0', versionCodes: [tv(3)] }] },
  ];
  // La piste fermée sert 1.20.0, mais la reprise part de « tv:internal » : rien à reprendre.
  assert.equal(playPromoteVerdict(tracks, '1.20.0', 'tv', 'tv:internal').plan, 'build');
  assert.equal(playPromoteVerdict(tracks, '1.11.0', 'tv', 'tv:internal').plan, 'promote');
  // Sans piste source, l'ancien comportement : n'importe quelle piste de test.
  assert.equal(playPromoteVerdict(tracks, '1.20.0', 'tv').plan, 'promote');
});

test('Play : la promotion ne reprend que la release qui porte la version', () => {
  const track = {
    releases: [
      { name: '1.8.1', status: 'completed', versionCodes: ['1400000'] },
      { name: '1.10.0', status: 'draft', versionCodes: ['1500000'] },
    ],
  };
  assert.deepEqual(promotableVersionCodes(track, '1.8.1'), ['1400000']);
  // Le piège d'avant : « le plus haut code servi » aurait promu 1.8.1 sous le nom 1.10.0.
  assert.equal(promotableVersionCodes(track, '1.10.0'), null);
  assert.equal(promotableVersionCodes({}, '1.8.1'), null);
});

test('Play : la version se lit dans le nom de la release, jamais devinée', () => {
  assert.equal(releaseVersion('1.8.1'), '1.8.1');
  assert.equal(releaseVersion('1400123 (1.8.1)'), '1.8.1');
  assert.equal(releaseVersion('Release sans numéro'), null);
  assert.equal(releaseVersion(undefined), null);
});
