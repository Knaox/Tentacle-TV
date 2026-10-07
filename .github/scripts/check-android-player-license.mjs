// Garde de licence des lecteurs Android — jouée par mobile.yml et tv.yml
// AVANT tout build Android au cran test ou store.
//
//   node .github/scripts/check-android-player-license.mjs mobile|tv
//
// Échoue si un artefact GPL côtoie Firebase / Play services dans l'APK, ou si
// un AAR de `android/maven-local` déclare autre chose que de la LGPL
// (lib/android-player-license.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { aarFfmpegLicenses, aarVerdict, apkVerdict } from './lib/android-player-license.mjs';

const app = process.argv[2];
const ROOTS = { mobile: ['apps/mobile/android', 'apps/mobile/modules'], tv: ['apps/tv/android', 'apps/tv/modules'] };
if (!ROOTS[app]) {
  console.error('usage : check-android-player-license.mjs mobile|tv');
  process.exit(1);
}

const walk = (dir, keep) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return ['node_modules', 'build', '.gradle', '.cxx'].includes(e.name) ? [] : walk(p, keep);
  return keep(e.name) ? [p] : [];
}) : []);

const gradleFiles = ROOTS[app].flatMap((root) => walk(root, (n) => /\.gradle(\.kts)?$/.test(n)));
const verdict = apkVerdict(gradleFiles.map((f) => fs.readFileSync(f, 'utf8')));
let failed = !verdict.ok;
for (const reason of verdict.reasons) console.error(`::error::${app} : ${reason}`);

for (const aar of walk(`apps/${app}/android/maven-local`, (n) => n.endsWith('.aar'))) {
  const licenses = aarFfmpegLicenses(aar);
  const v = aarVerdict(licenses);
  console.log(`${aar} : ${licenses.join(', ') || '(aucun FFmpeg)'}`);
  if (!v.ok) {
    failed = true;
    console.error(`::error file=${aar}::licence ${v.bad.join(', ')} — seule la LGPL est admise ici`);
  }
}
if (failed) process.exit(1);
console.log(`${app} : ${verdict.gpl.length ? `GPL (${verdict.gpl.join(', ')}) sans bibliothèque propriétaire` : 'aucun artefact GPL'} — conforme`);
