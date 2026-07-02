// CLI d'extraction des notes de version depuis CHANGELOG.md, formatées par store.
//
//   node .github/scripts/release-notes.mjs \
//     --channel mac|ios|atv|win|play  (requis)
//     --version X.Y.Z                 (requis)
//     --lang fr|en|both               (défaut : both pour --format github, sinon requis)
//     --format asc|play|msstore|github (défaut : github)
//     --changelog CHANGELOG.md        (défaut)
//     --out <fichier>                 (sinon stdout)
//
// Section introuvable → message sur stderr, AUCUN fichier créé, exit 0 (jamais
// bloquant — les workflows testent `[ -s fichier ]`). `github` = markdown brut ;
// autres formats = texte brut tronqué à la limite du store (asc 4000, play 500,
// msstore 1500).
import fs from 'node:fs';
import { loadNotes } from './lib/changelog.mjs';

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
}

const { channel, version, changelog = 'CHANGELOG.md', out } = args;
const format = args.format ?? 'github';
const lang = args.lang ?? (format === 'github' ? 'both' : null);

if (!channel || !version) {
  console.error('[release-notes] usage : --channel <c> --version <x.y.z> [--lang fr|en|both] [--format asc|play|msstore|github] [--out f]');
  process.exit(1);
}
if (!['asc', 'play', 'msstore', 'github'].includes(format)) {
  console.error(`[release-notes] format inconnu : ${format}`);
  process.exit(1);
}
if (!lang || !['fr', 'en', 'both'].includes(lang)) {
  console.error('[release-notes] --lang fr|en requis pour ce format (both réservé à github)');
  process.exit(1);
}
if (lang === 'both' && format !== 'github') {
  console.error('[release-notes] --lang both uniquement avec --format github');
  process.exit(1);
}

let notes;
try {
  notes = loadNotes({ changelog, channel, version, format });
} catch (e) {
  console.error(`[release-notes] lecture ${changelog} impossible : ${e.message}`);
  process.exit(1);
}
if (!notes) {
  console.error(`[release-notes] aucune section « ## [${channel}-${version}] » ni « ## [${version}] » dans ${changelog} — rien produit.`);
  process.exit(0);
}

const text = lang === 'both' ? notes.raw : (lang === 'fr' ? notes.fr : notes.en);
if (!text || !text.trim()) {
  console.error(`[release-notes] section trouvée mais vide pour lang=${lang} — rien produit.`);
  process.exit(0);
}

if (out) {
  fs.writeFileSync(out, text.trimEnd() + '\n');
  console.error(`[release-notes] ${out} écrit (${channel}-${version}, ${format}/${lang}, ${text.length} car.)`);
} else {
  process.stdout.write(text.trimEnd() + '\n');
}
