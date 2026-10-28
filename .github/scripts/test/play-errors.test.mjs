// Le refus de Play pour une déclaration de service de premier plan manquante,
// et la liste des services déclarés tenue contre les manifestes des modules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DECLARED_FOREGROUND_SERVICES, explainPlayError } from '../lib/play-errors.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MODULES = path.join(ROOT, 'apps/mobile/modules');

// Le message exact du run 40739431031 (2026-10-28).
const REFUSAL = 'POST /applications/com.tentacletv.mobile/edits/14611521863390070370:commit?changesNotSentForReview=false → 403 '
  + '{"code":403,"message":"You must let us know whether your app uses any Foreground Service permissions.","status":"PERMISSION_DENIED"}';

test('le 403 des services de premier plan renvoie vers la déclaration de la console', () => {
  const lines = explainPlayError(REFUSAL, 'com.tentacletv.mobile');
  assert.ok(lines);
  const text = lines.join('\n');
  assert.match(text, /Permissions de service de premier plan/);
  assert.match(text, /com\.tentacletv\.mobile/);
  assert.match(text, /FOREGROUND_SERVICE_MEDIA_PLAYBACK \(mediaPlayback\)/);
  assert.match(text, /FOREGROUND_SERVICE_DATA_SYNC \(dataSync\)/);
});

test('un autre refus de Play reste tel quel', () => {
  assert.equal(explainPlayError('POST … → 403 {"message":"The caller does not have permission"}'), null);
  assert.equal(explainPlayError('PUT … → 400 {"message":"APK specifies a version code that has already been used."}'), null);
  assert.equal(explainPlayError(undefined), null);
});

// Relit les manifestes Android des modules du dépôt : permission → types de service.
function moduleForegroundServices() {
  const found = {};
  for (const name of fs.readdirSync(MODULES)) {
    const file = path.join(MODULES, name, 'android/src/main/AndroidManifest.xml');
    if (!fs.existsSync(file)) continue;
    const xml = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const [, permission] of xml.matchAll(/uses-permission[^>]*android:name="(android\.permission\.FOREGROUND_SERVICE_[A-Z_]+)"/g)) {
      found[permission] = { ...found[permission], module: name };
    }
    for (const [, type] of xml.matchAll(/android:foregroundServiceType="([^"]+)"/g)) {
      found[`type:${type}`] = name;
    }
  }
  return found;
}

test('chaque service de premier plan des modules est dans la déclaration Play, et rien de plus', () => {
  const found = moduleForegroundServices();
  const permissions = Object.keys(found).filter((k) => k.startsWith('android.permission.')).sort();
  // Un type nouveau ici : déclarer d'abord dans la console (Contenu de l'application),
  // puis l'ajouter à DECLARED_FOREGROUND_SERVICES — sinon Play refuse le commit (403).
  assert.deepEqual(permissions, Object.keys(DECLARED_FOREGROUND_SERVICES).sort());
  for (const [permission, { type, module }] of Object.entries(DECLARED_FOREGROUND_SERVICES)) {
    assert.equal(found[permission].module, module, permission);
    assert.equal(found[`type:${type}`], module, `${permission} → foregroundServiceType="${type}"`);
  }
});
