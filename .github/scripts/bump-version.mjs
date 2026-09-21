// Bump d'un champ de versions.json — la source unique des versions.
//
//   node .github/scripts/bump-version.mjs <clé> <X.Y.Z> [--dry-run]
//
// POURQUOI ICI ET PLUS DANS `scripts/`. La racine `scripts/` est gitignorée
// (.gitignore ligne 11) : le fichier n'était donc PAS versionné, alors que la
// documentation et la page de déploiement le décrivaient comme « commité dans
// le repo ». La CI, qui doit désormais poser le bump elle-même, ne pouvait pas
// l'appeler. Il rejoint les autres outils de livraison, dans un répertoire
// réexclu de l'ignore (`!.github/scripts/`).
//
// LE package.json QUI SUIT AUTOMATIQUEMENT. Reporter le numéro à la main dans
// le package.json de la cible était une consigne — donc un oubli possible, et
// apps/tv en porte encore la trace (1.0.0 contre tv 1.3.0 dans versions.json).
// C'est fait ici, dans le même geste. Le backend en profite : son service de
// version lit versions.json d'abord et ne retombe sur son package.json que si
// le fichier manque (vieille image) — ce repli devient enfin vrai.
import fs from 'node:fs';

// Clés de versions.json → package.json à aligner (null = aucun).
const KEYS = {
  desktop: 'apps/desktop-electron/package.json',
  mobile: 'apps/mobile/package.json',
  tv: 'apps/tv/package.json',
  webos: 'apps/tv-webos/package.json',
  server: 'apps/backend/package.json',
  minServer: null, // exigence, pas une version livrée : aucun paquet ne la porte
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const [key, ver] = args.filter((a) => !a.startsWith('--'));

if (!(key in KEYS) || !/^\d+\.\d+\.\d+$/.test(ver ?? '')) {
  console.error(`usage : node .github/scripts/bump-version.mjs <${Object.keys(KEYS).join('|')}> <X.Y.Z> [--dry-run]`);
  process.exit(1);
}

/** Réécrit un champ `version` (ou une clé de versions.json) en gardant 2 espaces + saut final. */
function patch(file, mutate) {
  if (!fs.existsSync(file)) return null;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = mutate(json, true);
  if (before === ver) return { file, before, changed: false };
  mutate(json, false);
  if (!dryRun) fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  return { file, before, changed: true };
}

const touched = [
  patch('versions.json', (j, peek) => (peek ? j[key] : (j[key] = ver))),
  KEYS[key] ? patch(KEYS[key], (j, peek) => (peek ? j.version : (j.version = ver))) : null,
].filter(Boolean);

for (const t of touched) {
  console.log(t.changed ? `${t.file} : ${t.before} → ${ver}` : `${t.file} : déjà ${ver}`);
}
// Les chemins réellement modifiés, pour un `git add` par pathspec explicite.
const changed = touched.filter((t) => t.changed).map((t) => t.file);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `files=${changed.join(' ')}\nchanged=${changed.length > 0}\n`);
}
