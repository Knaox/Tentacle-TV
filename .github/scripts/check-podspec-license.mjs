// Garde de licence du lecteur avancé iOS — jouée par mobile.yml AVANT tout
// build iOS au cran test ou store.
//
//   node .github/scripts/check-podspec-license.mjs apps/mobile/ios/MPVKit.podspec
//
// Échoue si le podspec déclare une licence GPL, ou si son binaire ne vient
// pas d'une Release LGPL de `mpvkit.yml` (lib/podspec-license.mjs).
import fs from 'node:fs';
import { podspecVerdict } from './lib/podspec-license.mjs';

const path = process.argv[2];
if (!path || !fs.existsSync(path)) {
  console.error(`::error::podspec introuvable : ${path ?? '(aucun chemin)'}`);
  process.exit(1);
}
const verdict = podspecVerdict(fs.readFileSync(path, 'utf8'));
if (!verdict.ok) {
  for (const reason of verdict.reasons) console.error(`::error file=${path}::${reason}`);
  console.error('Lancer mpvkit.yml (variante LGPL), puis reporter :http, :sha256, version et license dans le podspec.');
  process.exit(1);
}
console.log(`MPVKit : ${verdict.license} — ${verdict.url}`);
