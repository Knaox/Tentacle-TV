// L'index des ressources des paquets MSIX, et les visuels qu'il doit trouver
// dans les deux dossiers du dépôt (bureau, Tentacle Server pour Windows).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import {
  candidatesFor,
  defaultLanguage,
  manifestAssets,
  missingAssets,
  priConfig,
} from '../lib/msix-resources.mjs';

const PACKAGES = ['apps/desktop-electron/msix', 'apps/server-windows/msix'];
const TARGET_SIZES = [16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256];

test("la configuration n'a pas de section packaging, et indexe les dossiers", () => {
  const config = priConfig('fr-FR');
  assert.doesNotMatch(config, /<packaging>/);
  assert.match(config, /<qualifier name="Language" value="fr-FR"\/>/);
  assert.match(config, /indexer-config type="folder"/);
  assert.doesNotMatch(config, /type="resw"/);
});

test('la langue par défaut est la première ressource du manifeste', () => {
  assert.equal(defaultLanguage('<Resource Language="fr-FR" /><Resource Language="en-US" />'), 'fr-FR');
  assert.equal(defaultLanguage('<Resources/>'), 'en-US');
});

test('les visuels nommés : attributs et <Logo>, sans doublon', () => {
  const manifest = '<Logo>Assets\\StoreLogo.png</Logo><x a="Assets\\Square44x44Logo.png" b="Assets\\StoreLogo.png"/>';
  assert.deepEqual(manifestAssets(manifest), ['Assets/Square44x44Logo.png', 'Assets/StoreLogo.png']);
});

test("une variante répond au nom qualifié, jamais à un voisin de préfixe", () => {
  const files = [
    'Square44x44Logo.scale-200.png',
    'Square44x44Logo.targetsize-24_altform-unplated.png',
    'Square44x44LogoBis.png',
    'Square150x150Logo.scale-100.png',
  ];
  assert.deepEqual(candidatesFor('Assets/Square44x44Logo.png', files), [
    'Square44x44Logo.scale-200.png',
    'Square44x44Logo.targetsize-24_altform-unplated.png',
  ]);
  assert.deepEqual(missingAssets('"Assets\\Wide310x150Logo.png"', files), ['Assets/Wide310x150Logo.png']);
});

for (const dir of PACKAGES) {
  test(`${dir} : chaque visuel du manifeste a ses variantes, sans plaque`, () => {
    const manifest = readFileSync(`${dir}/Package.appxmanifest`, 'utf8');
    const files = readdirSync(`${dir}/Assets`);
    assert.deepEqual(missingAssets(manifest, files), []);
    // Sans `altform-unplated` (et sa version claire), Windows pose l'icône
    // réduite sur une plaque à la couleur d'accent : les bordures du Store.
    for (const size of TARGET_SIZES) {
      for (const form of ['', '_altform-unplated', '_altform-lightunplated']) {
        assert.ok(files.includes(`Square44x44Logo.targetsize-${size}${form}.png`), `targetsize-${size}${form}`);
      }
    }
    for (const asset of manifestAssets(manifest)) {
      const scaled = candidatesFor(asset, files).filter((file) => /\.scale-\d+\./.test(file));
      assert.equal(scaled.length, 5, `${asset} : 100, 125, 150, 200 et 400 %`);
    }
    // Un nom nu à côté de ses variantes serait indexé comme un visuel de plus.
    assert.deepEqual(files.filter((file) => !/\.(scale|targetsize)-\d+/.test(file)), []);
  });
}
