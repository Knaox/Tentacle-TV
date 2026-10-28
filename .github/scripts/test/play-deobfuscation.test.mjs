// Le mapping R8 joint à un AAB envoyé à Play : chemin de l'API, contrôle du
// fichier avant l'édition, un envoi par versionCode — et le câblage du
// workflow mobile, qui doit l'archiver avec l'AAB et le passer à l'envoi.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DEOBFUSCATION_TYPE, deobfuscationUploadPath, mappingProblem, uploadMapping,
} from '../lib/play-deobfuscation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// Début réel d'un mapping.txt de R8 (AGP 8), abrégé.
const MAPPING = [
  '# compiler: R8',
  '# compiler_version: 8.9.35',
  '# min_api: 26',
  '# pg_map_id: 3e5c1a0',
  'android.support.v4.app.RemoteActionCompatParcelizer -> android.support.v4.app.RemoteActionCompatParcelizer:',
  '# {"id":"sourceFile","fileName":"RemoteActionCompatParcelizer.java"}',
  '    1:1:void <init>():11:11 -> <init>',
  'expo.modules.mpvplayer.MpvRenderer -> expo.modules.mpvplayer.MpvRenderer:',
  'kotlin.collections.ArraysKt -> a.b:',
  '',
].join('\n');

test('le chemin de edits.deobfuscationfiles.upload, type proguard', () => {
  assert.equal(DEOBFUSCATION_TYPE, 'proguard');
  assert.equal(
    deobfuscationUploadPath('com.tentacletv.mobile', 'E1', 1234567),
    '/applications/com.tentacletv.mobile/edits/E1/apks/1234567/deobfuscationFiles/proguard',
  );
  assert.throws(() => deobfuscationUploadPath('com.tentacletv.mobile', 'E1', 'abc'), /versionCode illisible/);
  assert.throws(() => deobfuscationUploadPath('com.tentacletv.mobile', '', 1), /requis/);
});

test('un vrai mapping passe ; vide ou d\'une autre forme, il est refusé', () => {
  assert.equal(mappingProblem(MAPPING), null);
  assert.match(mappingProblem(''), /vide/);
  assert.match(mappingProblem('  \n'), /vide/);
  assert.match(mappingProblem('# compiler: R8\n'), /forme/);
  assert.match(mappingProblem('BUILD SUCCESSFUL in 4m\n'), /forme/);
  assert.match(mappingProblem('PK\u0003\u0004 binaire'), /forme/);
});

test('un envoi par versionCode, sur l\'hôte d\'upload, en octets bruts', async () => {
  const calls = [];
  const logs = [];
  const play = { upload: async (p, bytes, type) => { calls.push({ p, size: bytes.length, type }); return {}; } };
  const bytes = Buffer.from(MAPPING);
  await uploadMapping(play, { pkg: 'com.tentacletv.mobile', editId: 'E9', versionCodes: ['42'], bytes, log: (l) => logs.push(l) });
  assert.deepEqual(calls, [{
    p: '/applications/com.tentacletv.mobile/edits/E9/apks/42/deobfuscationFiles/proguard',
    size: bytes.length,
    type: 'application/octet-stream',
  }]);
  assert.match(logs[0], /versionCode 42/);
});

test('un refus de Play remonte (l\'édition sera jetée par play-publish)', async () => {
  const play = { upload: async () => { throw new Error('POST … → 403 {}'); } };
  await assert.rejects(
    uploadMapping(play, { pkg: 'p', editId: 'E', versionCodes: ['1'], bytes: Buffer.from(MAPPING) }),
    /403/,
  );
});

test('mobile.yml archive le mapping avec l\'AAB et le joint à l\'envoi', () => {
  const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/mobile.yml'), 'utf8');
  assert.match(yml, /mapping\/release\/mapping\.txt/, 'le build doit récupérer mapping.txt');
  assert.match(yml, /--mapping aab\/mapping\.txt/, 'l\'envoi d\'un AAB doit joindre son mapping');
  // La reprise ne joint rien : son versionCode a déjà le sien.
  const promote = yml.match(/SOURCE="--promote-from[^\n]*/)?.[0] ?? '';
  assert.doesNotMatch(promote, /--mapping/);
});
