// Le plan d'une livraison de Tentacle Server pour Windows (server-windows.yml)
// — et, pour quiconque veut le savoir AVANT de lancer, ce qu'elle ferait.
//
//   node .github/scripts/server-windows-plan.mjs plan --channel build|test|store \
//     --sha <sha> [--image ghcr.io/knaox/tentacle-tv] [--versions versions.json]
//   node .github/scripts/server-windows-plan.mjs store --channel build|test|store
//
// `plan` lit versions.json (server, serverWindows, minServer) au commit extrait,
// interroge le registre en LECTURE SEULE (`:latest` et `:v<server>`), compare
// le serveur de l'arbre à celui qu'a publié « :v<server> » (git diff), puis
// écrit la décision dans $GITHUB_OUTPUT (et en JSON sur la sortie standard).
//
// `store` dit où part la soumission d'après SERVER_WINDOWS_STORE_ID et
// SERVER_WINDOWS_FLIGHT_ID (variables du dépôt) : rien, un vol, la fiche.
//
// Une décision impossible sort en 1 avec une annotation qui dit quoi faire.
// Env facultatifs (l'image est publique) : REGISTRY_USER, REGISTRY_TOKEN.
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setOutput } from './lib/github-output.mjs';
import { createRegistryClient } from './lib/registry.mjs';
import { LABELS, PlanError } from './lib/server-image.mjs';
import { SERVER_PATHS, planWindowsPackage, storeTarget } from './lib/server-windows.mjs';

const DEFAULT_IMAGE = 'ghcr.io/knaox/tentacle-tv';
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

/**
 * Les fichiers du serveur qui diffèrent entre deux commits, tests exclus (ils
 * ne partent pas dans le paquet). null si l'un des deux manque au clone.
 */
function serverDrift(from, to) {
  if (!from) return null;
  try {
    const out = execFileSync('git', [
      'diff', '--no-renames', '--name-only', from, to, '--', ...SERVER_PATHS,
      ':(exclude)*.test.ts', ':(exclude)*.test.tsx', ':(exclude)*.test.mjs',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

function stepSummary(plan) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const rows = [
    ['Cran', plan.channel],
    ['App Windows', `${plan.windowsVersion} (MSIX ${plan.msixVersion})`],
    ['Serveur embarqué', plan.serverVersion],
    ['Client LG', `${plan.clientVersion || 'non étiqueté'}, repris de \`:${plan.clientFrom}\``],
    ['Image du client', `\`${plan.clientImage}\``],
  ];
  const md = ['### Tentacle Server pour Windows — le plan', '', '| | |', '|---|---|',
    ...rows.map(([k, v]) => `| ${k} | ${v} |`), ''];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md.join('\n')}\n`);
}

async function plan() {
  const image = flag('image', DEFAULT_IMAGE);
  const sha = flag('sha');
  const versions = JSON.parse(readFileSync(flag('versions', 'versions.json'), 'utf8'));
  const registry = createRegistryClient({ username: process.env.REGISTRY_USER, password: process.env.REGISTRY_TOKEN });
  const [production, base] = await Promise.all([
    registry.inspect(`${image}:latest`),
    versions.server ? registry.inspect(`${image}:v${versions.server}`) : null,
  ]);
  const revision = base?.labels?.[LABELS.revision] || '';
  const result = planWindowsPackage({
    channel: flag('channel'),
    image,
    sha,
    serverVersion: versions.server,
    windowsVersion: versions.serverWindows,
    minServer: versions.minServer,
  }, { production, base, drift: revision ? serverDrift(revision, sha) : null });

  for (const n of result.notices) console.error(`::${n.level}::${n.text}`);
  console.error(`Plan de l'app Windows : ${result.summary}`);
  for (const [name, value] of Object.entries({
    'windows-version': result.windowsVersion,
    'msix-version': result.msixVersion,
    'server-version': result.serverVersion,
    tag: result.tag,
    'client-image': result.clientImage,
    'client-from': result.clientFrom,
    'client-version': result.clientVersion,
    summary: result.summary,
  })) setOutput(name, value);
  stepSummary(result);
  console.log(JSON.stringify(result, null, 2));
}

function store() {
  const target = storeTarget({
    channel: flag('channel'),
    storeId: process.env.SERVER_WINDOWS_STORE_ID?.trim() ?? '',
    flightId: process.env.SERVER_WINDOWS_FLIGHT_ID?.trim() ?? '',
  });
  setOutput('submit', Boolean(target));
  setOutput('store-id', target?.storeId ?? '');
  setOutput('flight-id', target?.flightId ?? '');
  console.error(!target ? 'Cran build : aucune soumission.'
    : target.flightId ? `Soumission au vol ${target.flightId} de ${target.storeId}.`
      : `Soumission PUBLIQUE de ${target.storeId}.`);
}

const commands = { plan, store };
if (!commands[command]) {
  console.error('usage : server-windows-plan.mjs plan --channel build|test|store --sha <sha> | store --channel <cran>');
  process.exit(1);
}
try {
  await commands[command]();
} catch (e) {
  const prefix = e instanceof PlanError ? '' : 'lecture du registre impossible — ';
  console.error(`::error::${prefix}${e.message}`);
  process.exit(1);
}
