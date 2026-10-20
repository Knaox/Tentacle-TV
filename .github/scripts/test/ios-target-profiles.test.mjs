// Le profil de diffusion par cible iOS : l'app et l'extension de la Live
// Activity reçoivent chacune LE LEUR, en Release seulement — sur le vrai projet.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { withTargetProfiles } from '../lib/ios-target-profiles.mjs';

const PROJECT = readFileSync(new URL('../../../apps/mobile/ios/TentacleTV.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
const PROFILES = { TentacleTV: 'Profil app', TransferLiveActivity: 'Profil extension' };

test('chaque cible a son profil, en Release seulement', () => {
  const out = withTargetProfiles(PROJECT, PROFILES);
  const lines = out.split('\n').filter((line) => line.includes('PROVISIONING_PROFILE_SPECIFIER'));
  assert.deepEqual(lines.map((line) => line.trim()).sort(), [
    'PROVISIONING_PROFILE_SPECIFIER = "Profil app";',
    'PROVISIONING_PROFILE_SPECIFIER = "Profil extension";',
  ]);
  // Rien d'autre ne bouge.
  assert.equal(out.replace(/\n\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = [^\n]*;/g, ''), PROJECT);
});

test('rejoué, le profil est remplacé, jamais doublé', () => {
  const twice = withTargetProfiles(withTargetProfiles(PROJECT, PROFILES), { TentacleTV: 'Autre' });
  assert.equal(twice.split('PROVISIONING_PROFILE_SPECIFIER').length - 1, 2);
  assert.match(twice, /PROVISIONING_PROFILE_SPECIFIER = "Autre";/);
});

test('une cible absente arrête la livraison', () => {
  assert.throws(() => withTargetProfiles(PROJECT, { Fantome: 'x' }), /absente/);
});
