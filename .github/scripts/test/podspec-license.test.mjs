// La garde de licence du lecteur iOS : un podspec GPL ne part jamais.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isCopyleftGpl, podspecVerdict, readPodspec } from '../lib/podspec-license.mjs';

const spec = (license, url) => `Pod::Spec.new do |s|
  s.license = { :type => '${license}', :text => '…' }
  s.source  = { :http => '${url}', :sha256 => 'abc' }
end`;
const LGPL_URL = 'https://github.com/Knaox/Tentacle-TV/releases/download/mpvkit-lgpl-0.41.0-av5/MPVKit.xcframework.zip';
const FORK_URL = 'https://github.com/streamyfin/MPVKit/releases/download/0.41.0-av5/MPVKit.xcframework.zip';

test('lit la licence et la source', () => {
  assert.deepEqual(readPodspec(spec('LGPL-3.0', LGPL_URL)), { license: 'LGPL-3.0', url: LGPL_URL });
  assert.equal(readPodspec("s.license = 'MIT'").license, 'MIT');
});

test('GPL, AGPL refusées ; LGPL admise', () => {
  for (const l of ['GPL-3.0', 'GPL-2.0-only', 'GPLv3', 'AGPL-3.0']) assert.equal(isCopyleftGpl(l), true, l);
  for (const l of ['LGPL-3.0', 'LGPL-2.1-or-later', 'LGPLv3']) assert.equal(isCopyleftGpl(l), false, l);
});

test('les binaires GPL du fork Streamyfin sont refusés', () => {
  const v = podspecVerdict(spec('GPL-3.0', FORK_URL));
  assert.equal(v.ok, false);
  assert.equal(v.reasons.length, 2);
});

test('une licence LGPL sur le binaire du fork est refusée aussi', () => {
  assert.equal(podspecVerdict(spec('LGPL-3.0', FORK_URL)).ok, false);
});

test('la Release LGPL de mpvkit.yml passe', () => {
  assert.deepEqual(podspecVerdict(spec('LGPL-3.0', LGPL_URL)).reasons, []);
});

test('le podspec du dépôt est lisible', () => {
  const v = podspecVerdict(readFileSync('apps/mobile/ios/MPVKit.podspec', 'utf8'));
  assert.ok(v.license);
  assert.ok(v.url);
});
