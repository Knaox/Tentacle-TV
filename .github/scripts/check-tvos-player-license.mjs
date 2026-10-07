// Garde de licence du lecteur de l'Apple TV — jouée par tv.yml AVANT tout
// build Apple TV au cran test ou store (lib/tvos-player-license.mjs).
//
//   node .github/scripts/check-tvos-player-license.mjs
import fs from 'node:fs';
import { tvosPlayerVerdict } from './lib/tvos-player-license.mjs';

const PACKAGE = 'apps/tv/ios/Vendor/PrismCore/Package.swift';
const RESOLVED = 'apps/tv/ios/TentacleTV.xcworkspace/xcshareddata/swiftpm/Package.resolved';
const verdict = tvosPlayerVerdict(fs.readFileSync(PACKAGE, 'utf8'), fs.readFileSync(RESOLVED, 'utf8'));
if (!verdict.ok) {
  for (const reason of verdict.reasons) console.error(`::error::${reason}`);
  process.exit(1);
}
console.log(`MPVKit ${verdict.pin.version} (${verdict.pin.revision}) — produit ${verdict.products.join(', ')}`);
