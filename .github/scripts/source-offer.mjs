// Rassemble l'offre de sources d'une livraison (lib/source-offer.mjs).
//
//   node .github/scripts/source-offer.mjs <app> <tag> <sha> <dossier>
//
// Écrit dans <dossier> : SOURCES.md, puis `<tag>-sources.tar` qui contient
// le code de Tentacle TV au commit livré (git archive) et l'archive amont de
// chaque composant GPL / LGPL embarqué, téléchargée à l'instant (on miroite :
// la disponibilité chez un tiers ne suffit pas). Un téléchargement manqué
// arrête tout — une offre incomplète ne doit pas partir pour complète.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, SOURCES, archiveName, sourcesManifest } from './lib/source-offer.mjs';

const [app, tag, sha, out] = process.argv.slice(2);
if (!APPS.includes(app) || !tag || !/^[0-9a-f]{7,40}$/.test(sha ?? '') || !out) {
  console.error(`usage : source-offer.mjs <${APPS.join('|')}> <tag> <sha> <dossier>`);
  process.exit(1);
}

const work = join(out, `${tag}-sources`);
mkdirSync(work, { recursive: true });
writeFileSync(join(out, 'SOURCES.md'), sourcesManifest(app, tag, sha));
writeFileSync(join(work, 'SOURCES.md'), sourcesManifest(app, tag, sha));
execFileSync('git', ['archive', '--format=tar.gz', `--prefix=tentacle-tv-${tag}/`, '-o', join(work, `tentacle-tv-${tag}.tar.gz`), sha], { stdio: 'inherit' });

SOURCES[app].forEach((component, index) => {
  const file = join(work, archiveName(component, index));
  console.log(`↓ ${component.name}`);
  execFileSync('curl', ['-fsSL', '--retry', '3', '--max-time', '900', '-o', file, component.url], { stdio: 'inherit' });
});

execFileSync('tar', ['-cf', join(out, `${tag}-sources.tar`), '-C', out, `${tag}-sources`], { stdio: 'inherit' });
console.log(`${join(out, `${tag}-sources.tar`)} : ${SOURCES[app].length} composants + Tentacle TV`);
