// Le patch du manifeste par le veilleur (patch-store-manifest.mjs), dans un dépôt jetable.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../patch-store-manifest.mjs', import.meta.url));

/** Un dépôt minuscule : le manifeste et deux changelogs, dans un dossier jetable. */
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'manifeste-'));
  mkdirSync(join(dir, 'updates'));
  mkdirSync(join(dir, 'changelogs'));
  writeFileSync(join(dir, 'updates/store-versions.json'), JSON.stringify({
    microsoftStore: { version: '1.0.0' },
    playMobile: { $comment: 'garde', version: '1.0.0', packageName: 'com.exemple', track: 'alpha' },
  }, null, 2));
  writeFileSync(join(dir, 'changelogs/desktop.md'),
    '## [1.1.0]\n### FR\n- bloc nu, macOS et Linux\n### EN\n- bare block, macOS and Linux\n\n'
    + '## [win-1.1.0]\n### FR\n- bloc Windows\n### EN\n- Windows block\n');
  writeFileSync(join(dir, 'changelogs/mobile.md'), '## [1.1.0]\n### FR\n- court\n### EN\n- short\n');
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  const manifest = () => JSON.parse(readFileSync(join(dir, 'updates/store-versions.json'), 'utf8'));
  return { run, manifest };
}

test('manifeste : le bloc Windows prend les notes du canal win, celles du Store', () => {
  const { run, manifest } = sandbox();
  assert.equal(run('1.1.0', '--only=ms').status, 0);
  assert.deepEqual(manifest().microsoftStore, { version: '1.1.0', notes: { fr: '• bloc Windows', en: '• Windows block' } });
});

test('manifeste : un bloc Play inscrit sa piste et garde ses autres champs', () => {
  const { run, manifest } = sandbox();
  assert.equal(run('1.1.0', '--changelog=changelogs/mobile.md', '--only=play-mobile', '--track=production').status, 0);
  const play = manifest().playMobile;
  assert.equal(play.version, '1.1.0');
  assert.equal(play.track, 'production');
  assert.equal(play.packageName, 'com.exemple');
  assert.equal(play.$comment, 'garde');
  assert.equal(run('1.1.0', '--changelog=changelogs/mobile.md', '--only=play-mobile', '--track=pas une piste').status, 1);
  assert.equal(run('9.9.9', '--only=ms').status, 1, 'sans bloc de changelog, rien n’est écrit');
  assert.equal(manifest().microsoftStore.version, '1.0.0');
});
