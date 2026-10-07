// L'offre de sources : chaque livraison sait quoi miroiter.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APPS, SOURCES, archiveName, sourcesManifest } from '../lib/source-offer.mjs';

test('chaque application a ses composants, chacun une archive https et une licence', () => {
  assert.deepEqual(APPS, ['mobile', 'tv', 'desktop', 'server']);
  for (const app of APPS) {
    assert.ok(SOURCES[app].length > 0, app);
    for (const c of SOURCES[app]) {
      assert.match(c.url, /^https:\/\//, c.name);
      assert.ok(c.license, c.name);
    }
  }
});

test("les noms d'archive sont uniques et gardent l'extension, même avec une requête", () => {
  for (const app of APPS) {
    const names = SOURCES[app].map(archiveName);
    assert.equal(new Set(names).size, names.length, app);
  }
  assert.equal(archiveName({ name: 'BusyBox — recette', url: 'https://x/a.tar.gz?path=main/busybox' }, 0), '01-busybox-recette.tar.gz');
  assert.equal(archiveName({ name: 'FFmpeg 8.1', url: 'https://ffmpeg.org/releases/ffmpeg-8.1.tar.xz' }, 9), '10-ffmpeg-8.1.tar.xz');
});

test('le mobile miroite ses lecteurs LGPL, la TV le GPL de son Android', () => {
  const names = (app) => SOURCES[app].map((c) => c.name).join(' | ');
  assert.match(names('mobile'), /MPVKit/);
  assert.match(names('mobile'), /AndroidX Media 1\.9\.0/);
  assert.doesNotMatch(names('mobile'), /Jellyfin/);
  assert.match(names('tv'), /Jellyfin Media3 FFmpeg decoder 1\.8\.0\+1/);
});

test('le manifeste dit le commit et liste chaque archive', () => {
  const md = sourcesManifest('server', 'server-v1.24.0', 'abc1234');
  assert.match(md, /`abc1234`/);
  assert.match(md, /tentacle-tv-server-v1\.24\.0\.tar\.gz/);
  assert.equal(md.split('\n').filter((l) => l.startsWith('| `')).length, SOURCES.server.length);
});
