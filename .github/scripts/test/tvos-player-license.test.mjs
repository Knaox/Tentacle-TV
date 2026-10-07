// La garde de licence du lecteur Apple TV : jamais le produit MPVKit-GPL.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mpvkitProducts, tvosPlayerVerdict } from '../lib/tvos-player-license.mjs';

const pkg = (product) => `.target(name: "PrismCore", dependencies: [ .product(name: "${product}", package: "MPVKit") ])`;
const resolved = (version) => JSON.stringify({ pins: [{ identity: 'mpvkit', state: { revision: 'abc', version } }] });

test('lit le produit réclamé', () => {
  assert.deepEqual(mpvkitProducts(pkg('MPVKit')), ['MPVKit']);
});

test('MPVKit-GPL est refusé', () => {
  assert.equal(tvosPlayerVerdict(pkg('MPVKit-GPL'), resolved('1.0.0')).ok, false);
});

test('une version de MPVKit non vérifiée est refusée', () => {
  assert.equal(tvosPlayerVerdict(pkg('MPVKit'), resolved('1.1.0')).ok, false);
  assert.equal(tvosPlayerVerdict(pkg('MPVKit'), JSON.stringify({ pins: [] })).ok, false);
});

test('le dépôt passe : MPVKit 1.0.0, produit LGPL', () => {
  const v = tvosPlayerVerdict(
    readFileSync('apps/tv/ios/Vendor/PrismCore/Package.swift', 'utf8'),
    readFileSync('apps/tv/ios/TentacleTV.xcworkspace/xcshareddata/swiftpm/Package.resolved', 'utf8'),
  );
  assert.deepEqual(v.reasons, []);
});
