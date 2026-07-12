// CLI d'extraction des notes de version, formatées par store.
//
//   node .github/scripts/release-notes.mjs \
//     --version X.Y.Z                 (requis)
//     --changelog <fichier>           (défaut CHANGELOG.md ; ex. changelogs/tv.md)
//     --channel mac|ios|atv|win|play  (mode legacy CHANGELOG.md racine : blocs
//                                      « ## [<canal>-<version>] » ; omis avec les
//                                      changelogs par domaine « ## [X.Y.Z] » nus)
//     --lang fr|en|both               (défaut : both pour --format github, sinon requis)
//     --format asc|play|msstore|github (défaut : github)
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

// --channel est optionnel : les changelogs par domaine (changelogs/*.md)
// utilisent des blocs « ## [X.Y.Z] » nus, sans préfixe de canal.
if (!version) {
  console.error('[release-notes] usage : --version <x.y.z> [--changelog f] [--channel <c>] [--lang fr|en|both] [--format asc|play|msstore|github] [--out f]');
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
  const wanted = channel ? `« ## [${channel}-${version}] » ni « ## [${version}] »` : `« ## [${version}] »`;
  console.error(`[release-notes] aucune section ${wanted} dans ${changelog} — rien produit.`);
  process.exit(0);
}

// Limites stores (caractères) — promises par l'en-tête mais jamais implémentées
// jusqu'ici : Play a rejeté une note de 501 car. (max 500). `github` = brut.
const LIMITS = { asc: 4000, play: 500, msstore: 1500 };

/** Coupe à la dernière puce complète sous la limite (repli : coupe dure + …). */
function truncate(t, limit) {
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit);
  const nl = cut.lastIndexOf('\n');
  if (nl > limit * 0.5) return cut.slice(0, nl).trimEnd();
  return cut.slice(0, limit - 1).trimEnd() + '…';
}

let text = lang === 'both' ? notes.raw : (lang === 'fr' ? notes.fr : notes.en);
if (!text || !text.trim()) {
  console.error(`[release-notes] section trouvée mais vide pour lang=${lang} — rien produit.`);
  process.exit(0);
}
text = text.trimEnd();
if (format !== 'github') text = truncate(text, LIMITS[format]);

// Formats stores : PAS de saut de ligne final — Google Play compte les octets
// du fichier (500 + '\n' = 501 → rejet).
const payload = format === 'github' ? text + '\n' : text;
if (out) {
  fs.writeFileSync(out, payload);
  console.error(`[release-notes] ${out} écrit (${channel}-${version}, ${format}/${lang}, ${text.length} car.)`);
} else {
  process.stdout.write(payload);
}
