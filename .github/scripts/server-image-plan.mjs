// Le plan de l'image serveur, pour le workflow commun server-image.yml — et
// pour quiconque veut savoir, AVANT de lancer, ce qu'une livraison ferait.
//
//   node .github/scripts/server-image-plan.mjs plan --mode server|webos \
//     --channel build|test|store --sha <sha> [--image ghcr.io/knaox/tentacle-tv] \
//     [--client-dir tv-client-dist] [--versions versions.json]
//   node .github/scripts/server-image-plan.mjs digest <image:étiquette>
//
// `plan` lit versions.json (server, webos, minServer) — celui du commit figé,
// puisque le job l'a extrait —, interroge le registre en LECTURE SEULE, et
// écrit la décision dans $GITHUB_OUTPUT (et en JSON sur la sortie standard).
// Une décision impossible sort en 1 avec une annotation qui dit quoi faire.
//
// `digest` écrit l'empreinte que désigne l'étiquette, ou rien avec le code 3
// si elle n'existe pas : c'est la relecture de « :latest » juste avant de la
// basculer (compare-and-swap, voir lib/server-image.mjs).
//
// Env (facultatifs, l'image est publique) : REGISTRY_USER, REGISTRY_TOKEN.
import { appendFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRegistryClient } from './lib/registry.mjs';
import { PlanError, planServerImage } from './lib/server-image.mjs';

const DEFAULT_IMAGE = 'ghcr.io/knaox/tentacle-tv';
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

const registry = createRegistryClient({
  username: process.env.REGISTRY_USER,
  password: process.env.REGISTRY_TOKEN,
});

/** Une sortie de job, multi-ligne si besoin (syntaxe à délimiteur de GitHub). */
function output(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  const text = String(value ?? '');
  if (!text.includes('\n')) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${text}\n`);
    return;
  }
  const delimiter = `EOF_${randomBytes(8).toString('hex')}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${text}\n${delimiter}\n`);
}

function stepSummary(plan) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = [
    ['Mode', plan.mode === 'server' ? 'serveur (server.yml)' : 'client LG (webos.yml)'],
    ['Cran', plan.channel],
    ['Serveur', plan.serverVersion],
    ['Client LG webOS', plan.clientVersion || 'non étiqueté'],
    ['Étiquettes', plan.tags.length ? plan.tags.map((t) => `\`:${t}\``).join(' ') : 'aucune — rien n\'est poussé'],
    ['Contextes nommés', plan.contexts.map((c) => `\`${c}\``).join('<br>')],
    ['Release', plan.release ? `\`${plan.release.tag}\` (notes : ${plan.release.changelog} [${plan.release.version}])` : '—'],
  ];
  const md = ['### Image serveur — le plan', '', '| | |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${v} |`), ''];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md.join('\n')}\n`);
}

async function plan() {
  const mode = flag('mode');
  const channel = flag('channel');
  const image = flag('image', DEFAULT_IMAGE);
  const versions = JSON.parse(readFileSync(flag('versions', 'versions.json'), 'utf8'));
  const params = {
    mode,
    channel,
    image,
    sha: flag('sha'),
    serverVersion: versions.server,
    webosVersion: versions.webos,
    minServer: versions.minServer,
    clientDir: flag('client-dir', 'tv-client-dist'),
  };

  // Deux lectures au plus, en parallèle. La base n'a de sens qu'en mode webos.
  const [production, base] = await Promise.all([
    registry.inspect(`${image}:latest`),
    mode === 'webos' && versions.server ? registry.inspect(`${image}:v${versions.server}`) : null,
  ]);
  const result = planServerImage(params, { production, base });

  for (const n of result.notices) console.error(`::${n.level}::${n.text}`);
  console.error(`Plan de l'image : ${result.summary}`);

  output('push', result.push);
  output('tags', result.tags.join(','));
  output('contexts', result.contexts.join('\n'));
  output('labels', Object.entries(result.labels).map(([k, v]) => `${k}=${v}`).join('\n'));
  output('expect-latest', result.expectLatest);
  output('server-version', result.serverVersion);
  output('client-version', result.clientVersion);
  output('release', Boolean(result.release));
  output('release-tag', result.release?.tag ?? '');
  output('release-title', result.release?.title ?? '');
  output('release-changelog', result.release?.changelog ?? '');
  output('release-version', result.release?.version ?? '');
  output('release-latest', result.release?.latest ?? '');
  output('release-header', result.release?.header.join('\n') ?? '');
  output('summary', result.summary);
  stepSummary(result);
  console.log(JSON.stringify(result, null, 2));
}

async function digest() {
  const ref = rest[0];
  if (!ref) throw new Error('usage : server-image-plan.mjs digest <image:étiquette>');
  const found = await registry.resolve(ref);
  if (!found) process.exit(3);
  console.log(found);
}

const commands = { plan, digest };
if (!commands[command]) {
  console.error('usage : server-image-plan.mjs plan --mode server|webos --channel build|test|store --sha <sha> | digest <ref>');
  process.exit(1);
}
try {
  await commands[command]();
} catch (e) {
  // Une décision impossible dit quoi faire ; une panne (réseau, registre) dit
  // ce qui a lâché. Dans les deux cas rien ne part : la garde ne se relâche
  // jamais sur une erreur.
  const prefix = e instanceof PlanError ? '' : 'lecture du registre impossible — ';
  console.error(`::error::${prefix}${e.message}`);
  process.exit(1);
}
