// Le bloc linux du manifeste (patch-linux-manifest.mjs), dans un dépôt jetable : chaque format
// annoncé pointe sur un paquet de la Release qu'il nomme.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../patch-linux-manifest.mjs', import.meta.url));
const H = (c) => c.repeat(64);

function sandbox(previous) {
  const dir = mkdtempSync(join(tmpdir(), 'linux-manifeste-'));
  mkdirSync(join(dir, 'updates'));
  writeFileSync(join(dir, 'updates/store-versions.json'), JSON.stringify({ linux: previous }, null, 2));
  const run = (sums, ...flags) => {
    writeFileSync(join(dir, 'SHA256SUMS'), sums);
    return spawnSync(process.execPath, [SCRIPT, '1.50.0', 'desktop-v1.50.0', 'SHA256SUMS', ...flags], { cwd: dir, encoding: 'utf8' });
  };
  const linux = () => JSON.parse(readFileSync(join(dir, 'updates/store-versions.json'), 'utf8')).linux;
  return { run, linux };
}

const before = {
  $comment: 'garde',
  version: '1.41.0',
  tag: 'desktop-v1.41.0',
  assets: {
    appimage: { name: 'tentacle-tv_1.41.0_x86_64.AppImage', sha256: H('a') },
    deb: { name: 'tentacle-tv_1.41.0_amd64.deb', sha256: H('b') },
  },
};

test('les quatre formats de la Release remplacent ceux de la précédente', () => {
  const { run, linux } = sandbox(before);
  const r = run(`${H('1')}  tentacle-tv_1.50.0_x86_64.AppImage\n${H('2')} *tentacle-tv_1.50.0_amd64.deb\n`);
  assert.equal(r.status, 0, r.stderr);
  const l = linux();
  assert.equal(l.$comment, 'garde');
  assert.equal(l.tag, 'desktop-v1.50.0');
  assert.deepEqual(l.assets.deb, { name: 'tentacle-tv_1.50.0_amd64.deb', sha256: H('2') });
  assert.equal(l.assets.appimage.name, 'tentacle-tv_1.50.0_x86_64.AppImage');
});

test('un format absent de la Release est un refus : jamais un asset d’une autre version sous le tag nouveau', () => {
  const { run, linux } = sandbox(before);
  const r = run(`${H('1')}  tentacle-tv_1.50.0_x86_64.AppImage\n`);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /pas de paquet deb/);
  assert.equal(linux().version, '1.41.0');  // rien d'écrit
});

test('--drop-missing retire le format, en le disant', () => {
  const { run, linux } = sandbox(before);
  const r = run(`${H('1')}  tentacle-tv_1.50.0_x86_64.AppImage\n`, '--drop-missing');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(Object.keys(linux().assets), ['appimage']);
  assert.match(r.stderr, /formats retirés du bloc linux : deb/);
});
