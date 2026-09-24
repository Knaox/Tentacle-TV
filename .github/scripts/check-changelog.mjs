// Pré-vol des notes de version — joué AVANT de construire quoi que ce soit.
//
//   node .github/scripts/check-changelog.mjs --changelog changelogs/desktop.md \
//     --version 1.21.5 --check asc:mac --check msstore:win --check github
//
// POURQUOI. `release-notes.mjs` sort en 0 sans écrire de fichier quand le bloc
// manque, et les workflows enchaînaient avec « || true » : un bloc absent
// donnait une publication SANS NOTES, en silence, chez l'utilisateur. Le seul
// moment où ce défaut se rattrape sans rien gâcher, c'est avant le build.
//
// CE QUI FAIT ÉCHOUER : bloc introuvable pour la version exacte, ou vide dans
// l'une des deux langues. « ## [Unreleased] » ne peut pas passer — on cherche
// le bloc de la version, et lui seul. Pour App Store Connect (`asc`), aussi un
// caractère qu'Apple refuse (ASC_FORBIDDEN, lib/changelog.mjs) : les notes y
// seraient rejetées en silence, et la soumission à l'examen échouerait ensuite.
//
// CE QUI FAIT SEULEMENT AVERTIR : un texte plus long que la limite du store.
// La coupe à la puce est voulue, mais elle est SILENCIEUSE — c'est elle qui a
// fait naître les blocs « ## [win-X.Y.Z] » de changelogs/desktop.md. Autant la
// voir arriver, et de combien.
import { loadNotes, extractSection, findAscForbidden, toPlainText, LIMITS } from './lib/changelog.mjs';
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const changelog = flag('changelog');
const version = flag('version');
const checks = args.reduce((acc, a, i) => (a === '--check' ? [...acc, args[i + 1]] : acc), []);

if (!changelog || !version || checks.length === 0) {
  console.error('usage : check-changelog.mjs --changelog <fichier> --version <X.Y.Z> --check <format[:canal]> […]');
  process.exit(1);
}
if (!fs.existsSync(changelog)) {
  console.error(`::error::${changelog} est introuvable.`);
  process.exit(1);
}

const md = fs.readFileSync(changelog, 'utf8');
let failed = false;

for (const spec of checks) {
  const [format, channel] = spec.split(':');
  if (!['asc', 'play', 'msstore', 'github'].includes(format)) {
    console.error(`::error::format « ${format} » inconnu (asc|play|msstore|github).`);
    process.exit(1);
  }
  const label = channel ? `${format} (canal ${channel})` : format;

  const section = extractSection(md, { channel, version });
  if (!section) {
    const wanted = channel ? `« ## [${channel}-${version}] » ni « ## [${version}] »` : `« ## [${version}] »`;
    console.error(`::error::${label} — aucun bloc ${wanted} dans ${changelog}. Renomme « ## [Unreleased] » en « ## [${version}] », ou écris le bloc.`);
    failed = true;
    continue;
  }

  const notes = loadNotes({ changelog, channel, version, format });
  const missing = ['fr', 'en'].filter((l) => !notes?.[l]?.trim());
  if (missing.length > 0) {
    console.error(`::error::${label} — bloc trouvé mais vide en ${missing.join(' et ')}.`);
    failed = true;
    continue;
  }

  // L'annotation `file=…,line=…` pointe la ligne dans l'onglet du run ; la
  // ligne est aussi écrite en clair pour qui lit le journal brut.
  if (format === 'asc') {
    const hits = findAscForbidden(md, section, { fr: notes.fr, en: notes.en });
    for (const hit of hits) {
      const where = `ligne ${hit.line}${hit.lang ? ` (${hit.lang})` : ''}`;
      console.error(`::error file=${changelog},line=${hit.line}::${label} — ${where} : « ${hit.char} » (${hit.code}) ${hit.why}. Retire-le : les notes seraient rejetées et la version ne pourrait pas être soumise.`);
    }
    if (hits.length > 0) {
      failed = true;
      continue;
    }
  }

  const limit = LIMITS[format];
  const parts = [];
  for (const lang of ['fr', 'en']) {
    // Longueur AVANT troncature : c'est elle qui dit s'il y a coupe.
    const full = toPlainText(section[lang]).length;
    const kept = notes[lang].length;
    if (limit && full > limit) {
      console.log(`::warning::${label} — ${lang.toUpperCase()} coupé à la puce : ${full} caractères pour ${limit}, ${full - limit} de trop.`);
    }
    parts.push(`${lang.toUpperCase()} ${kept}${limit ? `/${limit}` : ''}`);
  }
  console.log(`✓ ${label} — ${parts.join(' · ')}`);
}

if (failed) {
  console.error(`\n::error::Notes de version ${version} incomplètes ou refusées : rien ne part.`);
  process.exit(1);
}
console.log(`\nNotes de version ${version} complètes (${changelog}).`);
