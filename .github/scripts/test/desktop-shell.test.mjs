// La garde de coquille du bureau : Electron < 1.50.0 ≤ CEF.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FIRST_CEF_VERSION, desktopShellFor, shellRefusal } from '../lib/desktop-shell.mjs';

test('la 1.50.0 est la première version CEF', () => {
  assert.equal(FIRST_CEF_VERSION, '1.50.0');
  assert.equal(desktopShellFor('1.42.0'), 'electron');
  assert.equal(desktopShellFor('1.49.99'), 'electron');
  assert.equal(desktopShellFor('1.50.0'), 'cef');
  assert.equal(desktopShellFor('2.0.0'), 'cef');
  assert.throws(() => desktopShellFor('1.50'), /illisible/);
});

test('le workflow Electron livre une 1.4x, jamais une 1.50.0', () => {
  assert.equal(shellRefusal({ shell: 'electron', channel: 'store', current: '1.42.0' }), null);
  assert.equal(shellRefusal({ shell: 'electron', channel: 'test', current: '1.42.0', bump: '1.43.0' }), null);
  assert.match(shellRefusal({ shell: 'electron', channel: 'store', current: '1.50.0' }), /refusé.*Rien ne part/);
  assert.match(shellRefusal({ shell: 'electron', channel: 'test', current: '1.50.0' }), /desktop\.yml construit Electron/);
  // Le bump vers l'ère CEF est refusé à tous les crans : il pousserait le numéro et le tag.
  assert.match(shellRefusal({ shell: 'electron', channel: 'build', current: '1.42.0', bump: '1.50.0' }), /bump .*1\.50\.0 refusé/);
  // Construire pour voir, sans bump : permis, rien ne part.
  assert.equal(shellRefusal({ shell: 'electron', channel: 'build', current: '1.50.0' }), null);
});

test('la chaîne CEF ne livre jamais un numéro de l’ère Electron', () => {
  assert.equal(shellRefusal({ shell: 'cef', channel: 'store', current: '1.50.0' }), null);
  assert.match(shellRefusal({ shell: 'cef', channel: 'store', current: '1.42.0' }), /cette chaîne construit CEF/);
  assert.match(shellRefusal({ shell: 'cef', channel: 'test', current: '1.50.0', bump: '1.49.0' }), /refusé/);
});

test('une entrée illisible est un refus, jamais un feu vert', () => {
  assert.match(shellRefusal({ shell: 'electron', channel: 'store', current: 'null' }), /illisible/);
  assert.match(shellRefusal({ shell: 'tauri', channel: 'store', current: '1.42.0' }), /inconnue/);
});

test('la commande sort en erreur, avec une annotation, sur un refus', () => {
  const cli = fileURLToPath(new URL('../desktop-shell-guard.mjs', import.meta.url));
  const ok = execFileSync('node', [cli, '--shell', 'electron', '--channel', 'store', '--current', '1.42.0', '--bump', ''],
    { encoding: 'utf8' });
  assert.match(ok, /coquille electron/);
  assert.throws(
    () => execFileSync('node', [cli, '--shell', 'electron', '--channel', 'store', '--current', '1.50.0'], { stdio: 'pipe' }),
    (e) => e.status === 1 && /::error::/.test(String(e.stdout)),
  );
});
