#!/usr/bin/env node
// Garde de qualité jouée AVANT que le push parte.
//
// POURQUOI ICI ET PAS SEULEMENT DANS LA CI. Un workflow s'exécute après coup :
// il peut refuser de livrer, il ne peut pas défaire un commit déjà poussé. Le
// seul endroit où un push se refuse, c'est la machine qui le lance.
//
// POURQUOI EN NODE. Le crochet doit se comporter à l'identique sous Windows
// (bash de Git for Windows), macOS et Linux. Node est le seul interpréteur
// réellement commun aux trois ; `.githooks/pre-push` n'est qu'un lanceur d'une
// ligne. Tout le crochet tient dans ce répertoire — et `scripts/` est
// gitignoré à la racine, donc il n'aurait de toute façon pas voyagé. Le répertoire `.githooks/` est SUIVI PAR GIT — c'est ce qui le fait
// voyager avec le dépôt (et avec Syncthing), là où `.git/hooks` ne sort jamais
// de la machine. Activation : `git config core.hooksPath .githooks`, posée
// automatiquement par le script « prepare » de la racine à chaque install.
//
// PORTÉE. On ne contrôle QUE les paquets touchés et ceux qui en dépendent
// (sélecteur pnpm `...[<ref>]`). Toucher apps/mobile ne réveille pas le web ;
// toucher packages/shared réveille tout ce qui en dépend. Aucune liste de
// chemins à tenir à jour : le graphe de dépendances du workspace fait foi.
//
// PAS DE LINT, et ce n'est pas un oubli : `pnpm lint` est cassé dans tout le
// dépôt (eslint n'y est déclaré en dépendance nulle part). Même raison que
// dans .github/workflows/quality.yml.
//
// Échappatoire : TENTACLE_SKIP_HOOK=1 git push  (ou --no-verify). La garde
// côté CI (.github/actions/require-quality) rattrape ces cas-là.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ZERO = '0'.repeat(40);
// La racine du workspace est TOUJOURS retenue par le sélecteur `...[ref]`, et
// son script `typecheck` vaut `pnpm -r typecheck` : la laisser passer relance
// tout le dépôt et annule la portée. Mesuré : un commit mobile seul donnait
// « Scope: 13 of 14 workspace projects ». D'où les filtres nommés un par un.
const ROOT_PACKAGE = 'tentacle-tv';
const BACKEND = '@tentacle-tv/backend';

/** Exécute une commande en héritant du terminal. `shell` pour pnpm.cmd (Windows). */
function run(command, { capture = false } = {}) {
  const r = spawnSync(command, {
    shell: true,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  return { code: r.status ?? 1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout ?? '').trim() : null;
}

function bail(message) {
  console.error(`\n\x1b[31m✗ push refusé — ${message}\x1b[0m`);
  console.error('  Corrige, ou force avec : TENTACLE_SKIP_HOOK=1 git push …\n');
  process.exit(1);
}

// ── Les références poussées arrivent sur stdin : "<ref> <sha> <ref> <sha>" ──
function readPushedRefs() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    raw = '';
  }
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [localRef, localSha, remoteRef, remoteSha] = l.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

/**
 * Base de comparaison : ce que le distant a DÉJÀ. Sur une branche neuve
 * (remoteSha à zéro) on se rabat sur origin/main, puis sur la racine de
 * l'historique — mieux vaut trop contrôler que pas assez.
 */
function resolveBase(refs) {
  const known = refs
    .map((r) => r.remoteSha)
    .filter((sha) => sha && sha !== ZERO && git(['rev-parse', '--verify', `${sha}^{commit}`]));
  if (known.length > 0) return known[0];
  const fallback = git(['rev-parse', '--verify', 'origin/main^{commit}']);
  if (fallback) return fallback;
  return null;
}

function selectedPackages(base) {
  const filter = base ? `--filter "...[${base}]"` : '';
  const cmd = `pnpm ${filter} list --depth -1 --json`;
  const { code, out, err } = run(cmd, { capture: true });
  if (code !== 0) bail(`pnpm n'a pas pu lister les paquets touchés.\n${err.trim()}`);
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch {
    bail('sortie de « pnpm list » illisible.');
  }
  return parsed.map((p) => p.name).filter((n) => n && n !== ROOT_PACKAGE);
}

function main() {
  if (process.env.TENTACLE_SKIP_HOOK === '1') return;

  const root = git(['rev-parse', '--show-toplevel']);
  if (root) process.chdir(root);

  const refs = readPushedRefs();
  // Suppression de branche distante (sha local à zéro) : rien à contrôler.
  if (refs.length > 0 && refs.every((r) => r.localSha === ZERO)) return;

  const base = resolveBase(refs);
  const packages = selectedPackages(base);

  if (packages.length === 0) {
    console.log('\x1b[2m▸ qualité : aucun paquet touché — rien à contrôler.\x1b[0m');
    return;
  }

  console.log(`\x1b[2m▸ qualité (depuis ${base ? base.slice(0, 8) : 'la racine'}) : ${packages.join(', ')}\x1b[0m`);

  // Le client Prisma est un stub tant que « db:generate » n'a pas tourné :
  // chaque résultat de requête devient `any` et une quinzaine de TS7006
  // tombent sur du code parfaitement sain. Même geste que quality.yml.
  if (packages.includes(BACKEND)) {
    const gen = run(`pnpm --filter ${BACKEND} db:generate`);
    if (gen.code !== 0) bail('« prisma generate » a échoué.');
  }

  const filters = packages.map((n) => `--filter ${n}`).join(' ');
  for (const script of ['typecheck', 'test']) {
    const r = run(`pnpm ${filters} --if-present run ${script}`);
    if (r.code !== 0) bail(`« ${script} » a échoué.`);
  }

  console.log('\x1b[32m✓ qualité : c\'est bon.\x1b[0m');
}

main();
