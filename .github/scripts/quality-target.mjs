// Le commit dont le verdict de qualité vaut pour une livraison.
//
//   node .github/scripts/quality-target.mjs <sha>
//
// Écrit sur la sortie standard le SHA dont `.github/actions/require-quality`
// doit lire les runs de quality.yml, et explique son choix sur la sortie
// d'erreur, donc dans le journal du run.
//
// POURQUOI. Les commits que la CI pose elle-même sur `main` (action push-main :
// manifestes des stores, bump de version) partent avec GITHUB_TOKEN, et un push
// fait avec ce jeton ne déclenche AUCUN workflow : quality.yml ne tourne jamais
// sur eux. Après chaque livraison au cran store, la tête de `main` restait donc
// sans contrôle, et la livraison suivante attendait vingt minutes pour rien
// avant d'échouer — Windows 1.22.0 puis macOS + Linux, le 2026-09-23.
//
// LA RÈGLE. Un commit qui a un run de qualité porte son propre verdict, vert ou
// rouge : on n'hérite jamais par-dessus un run existant. Un commit SANS run dont
// le changement est NEUTRE (voir NEUTRAL) hérite du verdict de son premier
// parent, et ainsi de suite. Dès qu'un commit sans run touche autre chose, on
// renonce : c'est le commit visé lui-même qu'on attend, comme avant — et c'est
// lui que rattrape un `gh workflow run quality.yml --ref main`.
//
// POURQUOI PAS UN DISPATCH DE quality.yml APRÈS CHAQUE PUSH DU BOT. Un dispatch
// contrôle TOUT le dépôt (pas de base de comparaison), exige `actions: write` à
// chaque job qui pousse, et partage le groupe de concurrence des pushs sur
// `main` : il annulerait le run d'un push humain qu'une livraison attend.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Ce qu'un changement NEUTRE a le droit de toucher. Liste FERMÉE : tout autre
// chemin arrête l'héritage. `null` = le fichier entier ; une liste = les seules
// clés de premier niveau qui peuvent changer, tout le reste doit rester
// identique. Critère d'entrée : aucun typecheck ni aucun test ne lit ce qui
// change — ni directement, ni par un `define` de Vite qu'un module testé
// consommerait (vérifié le 2026-09-24).
const NEUTRAL = new Map([
  // Manifeste lu À L'EXÉCUTION par les clients (raw.githubusercontent.com),
  // jamais au build. C'est tout ce que le bot a poussé jusqu'ici.
  ['updates/store-versions.json', null],
  // Les clés qu'écrit bump-version.mjs — SAUF `desktop` : registry.test.ts
  // (web) exige une entrée de nouveautés pour cette version-là, un bump
  // desktop peut donc le faire tomber. Celui-là attend un vrai contrôle.
  ['versions.json', ['mobile', 'tv', 'webos', 'server', 'minServer']],
  // Les package.json qu'aligne bump-version.mjs (sa table KEYS), champ
  // `version` seul : un bump qui toucherait une dépendance n'est plus neutre.
  ['apps/desktop-electron/package.json', ['version']],
  ['apps/mobile/package.json', ['version']],
  ['apps/tv/package.json', ['version']],
  ['apps/tv-webos/package.json', ['version']],
  ['apps/backend/package.json', ['version']],
]);

// Au-delà, on renonce : trente commits sans run de qualité d'affilée, c'est
// que quelque chose d'autre ne va pas.
const MAX_DEPTH = 30;

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

const short = (sha) => sha.slice(0, 8);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Le JSON d'un fichier à un commit donné, ou null s'il manque ou ne se lit pas. */
function readJson(commit, path) {
  const text = tryGit('show', `${commit}:${path}`);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Le changement de `parent` à `commit` : les chemins touchés, et le premier
 * qui le rend NON neutre (null s'il est neutre). Un commit vide est neutre.
 */
function describeChange(parent, commit) {
  // --no-renames : un renommage doit montrer ses DEUX chemins. Sinon un fichier
  // de code renommé en manifeste passerait pour une retouche du manifeste.
  const paths = git('diff', '--no-renames', '--name-only', parent, commit).split('\n').filter(Boolean);
  for (const path of paths) {
    if (!NEUTRAL.has(path)) return { paths, blocker: path };
    const keys = NEUTRAL.get(path);
    if (keys === null) continue;
    const before = readJson(parent, path);
    const after = readJson(commit, path);
    // Créé, supprimé ou illisible d'un côté : ce n'est plus une retouche de champ.
    if (!isPlainObject(before) || !isPlainObject(after)) return { paths, blocker: path };
    // L'ordre des clés est conservé : dans un package.json, celui des
    // conditions d'`exports` a un sens.
    const rest = (json) => JSON.stringify(Object.entries(json).filter(([key]) => !keys.includes(key)));
    if (rest(before) !== rest(after)) return { paths, blocker: `${path} (au-delà de ${keys.join(', ')})` };
  }
  return { paths, blocker: null };
}

/**
 * Le commit dont le verdict vaut pour `sha`. `runCount(commit)` donne le nombre
 * de runs de quality.yml sur un commit, tous états confondus : c'est le seul
 * accès au réseau, injecté pour que la décision se rejoue hors CI.
 */
export function findQualityTarget(sha, runCount, log = () => {}) {
  let commit = sha;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (runCount(commit) > 0) {
      if (commit !== sha) log(`→ ${short(sha)} hérite du verdict de ${short(commit)}.`);
      return commit;
    }
    const parent = tryGit('rev-parse', '--verify', '--quiet', `${commit}^1`);
    if (!parent) {
      log(`${short(commit)} n'a pas de parent dans ce clone : pas d'héritage possible.`);
      return sha;
    }
    const { paths, blocker } = describeChange(parent, commit);
    if (blocker) {
      log(commit === sha
        ? `${short(sha)} n'a pas encore de run de qualité et touche ${blocker} : c'est le sien qu'on attend.`
        : `${short(commit)} touche ${blocker} sans avoir de run de qualité : pas d'héritage, on attend celui de ${short(sha)}.`);
      return sha;
    }
    const touched = paths.length ? `ne touche que ${paths.join(', ')}` : 'ne change rien';
    log(`${short(commit)} n'a pas de run de qualité et ${touched} : on remonte à ${short(parent)}.`);
    commit = parent;
  }
  log(`plus de ${MAX_DEPTH} commits d'affilée sans run de qualité : pas d'héritage.`);
  return sha;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2] ?? '';
  const repo = process.env.GITHUB_REPOSITORY;
  if (!input || !repo) {
    console.error('usage : GITHUB_REPOSITORY=<propriétaire/dépôt> node .github/scripts/quality-target.mjs <sha>');
    process.exit(1);
  }
  // L'API ne filtre que sur un SHA complet ; un commit absent du clone ne peut
  // rien hériter, il reste tel quel.
  const sha = tryGit('rev-parse', '--verify', '--quiet', `${input}^{commit}`) ?? input;
  const runCount = (commit) => {
    const out = execFileSync('gh', [
      'api', `repos/${repo}/actions/workflows/quality.yml/runs?head_sha=${commit}&per_page=1`,
      '--jq', '.total_count',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    // Une réponse illisible compterait pour « aucun run » et ferait remonter
    // par-dessus un verdict, peut-être rouge, qu'on n'a pas su lire.
    if (!/^\d+$/.test(out)) throw new Error(`nombre de runs illisible pour ${short(commit)} : « ${out} »`);
    return Number(out);
  };
  try {
    console.log(findQualityTarget(sha, runCount, (message) => console.error(message)));
  } catch (e) {
    // Une panne ici ne doit jamais relâcher la garde : on retombe sur le commit visé.
    const reason = (e.stderr?.toString().trim() || e.message).split('\n')[0];
    console.error(`::warning::héritage du verdict de qualité indisponible (${reason}) — on s'en tient à ${short(sha)}.`);
    console.log(sha);
  }
}
