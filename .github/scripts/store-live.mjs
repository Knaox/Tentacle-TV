#!/usr/bin/env node
// Ce que chaque boutique sert RÉELLEMENT, en JSON :
//   { macos, ios, appletv, windows, android, androidtv, linux, server, webos }
// Une valeur null veut dire INCONNU (lecture impossible), jamais « rien ».
//
//   node .github/scripts/store-live.mjs [--out <fichier>]
//
// Toutes les lectures sont en lecture seule, et aucune n'ouvre d'édition Play :
//   • macOS, iOS, Apple TV : App Store Connect, plus haute version en vente ;
//   • Windows : notes affichées par la vitrine publique du Microsoft Store,
//     rapprochées de changelogs/desktop.md (lib/store-listings.mjs) ;
//   • Android : API de rapports Play, releases actives de PRODUCTION
//     (lib/play-reporting.mjs) ; pour le téléphone, recoupée avec la fiche
//     publique — des deux, la plus basse ;
//   • Linux : le manifeste (la release GitHub fait foi, posée au cran store) ;
//   • serveur, webOS : dernière release GitHub publiée (ni brouillon ni pré-version).
//
// Env (chacun facultatif — sa source passe alors à null avec un avertissement) :
//   ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8 · PLAY_SERVICE_ACCOUNT_JSON · GITHUB_TOKEN
//   (+ BUNDLE_ID, PLAY_PACKAGE, MS_STORE_ID, GITHUB_REPOSITORY pour changer de cible).
// Exit 1 seulement si TOUT est inconnu : une source en panne ne rougit pas le
// veilleur toutes les trente minutes, elle laisse un avertissement.
import { readFileSync, writeFileSync } from 'node:fs';
import { createAscClient, findApp, liveVersion } from './lib/asc-api.mjs';
import { loadNotes } from './lib/changelog.mjs';
import { describeTracks, fetchReleaseTracks, productionVersions } from './lib/play-reporting.mjs';
import { fetchMsStoreNotes, fetchPlayWhatsNew, matchNotesVersion } from './lib/store-listings.mjs';
import { changelogVersions, isVersion, maxVersion, minVersion } from './lib/versions.mjs';

const env = process.env;
const BUNDLE_ID = env.BUNDLE_ID || 'com.tentacle.mobile';
const PLAY_PACKAGE = env.PLAY_PACKAGE || 'com.tentacletv.mobile';
const MS_STORE_ID = env.MS_STORE_ID || '9NKHL0T84245';
const REPO = env.GITHUB_REPOSITORY || 'Knaox/Tentacle-TV';

const outIdx = process.argv.indexOf('--out');
const out = outIdx >= 0 ? process.argv[outIdx + 1] : null;

const log = (msg) => console.error(`[live] ${msg}`);
// Les annotations GitHub passent par stdout — sauf en local sans --out, où
// stdout porte le JSON.
const warn = (msg) => (out ? console.log : console.error)(`::warning title=Veilleur des stores::${msg}`);
const why = (e) => (e instanceof Error ? e.message : String(e));

const result = {
  macos: null, ios: null, appletv: null, windows: null,
  android: null, androidtv: null, linux: null, server: null, webos: null,
};

/** La version d'un changelog dont les notes, mises en forme pour la boutique, sont `shown`. */
function versionFromNotes(shown, changelog, { channel, format }) {
  const versions = changelogVersions(readFileSync(changelog, 'utf8'));
  return matchNotesVersion(shown, versions, (version) => loadNotes({ changelog, channel, version, format })?.en);
}

async function apple() {
  if (!env.ASC_KEY_ID || !env.ASC_ISSUER || !env.ASC_KEY_P8) {
    warn('App Store Connect : clé absente — macOS, iOS et Apple TV inconnus.');
    return;
  }
  const api = createAscClient({ keyId: env.ASC_KEY_ID, issuer: env.ASC_ISSUER, p8: env.ASC_KEY_P8 });
  const app = await findApp(api, BUNDLE_ID);
  for (const [key, platform] of [['macos', 'MAC_OS'], ['ios', 'IOS'], ['appletv', 'TV_OS']]) {
    try {
      result[key] = await liveVersion(api, app.id, platform);
      log(`App Store ${platform} : ${result[key] ?? 'aucune version en vente'}`);
    } catch (e) {
      warn(`App Store Connect ${platform} : ${why(e)}`);
    }
  }
}

async function windows() {
  const shown = await fetchMsStoreNotes(MS_STORE_ID, log);
  if (!shown) {
    warn('Microsoft Store : notes publiques illisibles — Windows inconnu.');
    return;
  }
  result.windows = versionFromNotes(shown, 'changelogs/desktop.md', { channel: 'win', format: 'msstore' });
  if (result.windows) log(`Microsoft Store : ${result.windows} (notes publiques)`);
  else warn('Microsoft Store : les notes en ligne ne correspondent à aucun bloc de changelogs/desktop.md.');
}

async function android() {
  let reported = { phone: null, tv: null };
  if (env.PLAY_SERVICE_ACCOUNT_JSON) {
    try {
      const tracks = await fetchReleaseTracks(env.PLAY_SERVICE_ACCOUNT_JSON, PLAY_PACKAGE);
      for (const line of describeTracks(tracks)) log(`Play : ${line}`);
      reported = productionVersions(tracks);
    } catch (e) {
      warn(`Play, API de rapports : ${why(e)} — Android TV inconnu, téléphone lu sur la fiche publique.`);
    }
  } else {
    warn('Play : PLAY_SERVICE_ACCOUNT_JSON absent — Android TV inconnu.');
  }

  // La fiche publique ne montre que les notes du téléphone. Si elle affiche
  // un jour celles de la TV, elle ne prouve rien pour le téléphone : on
  // l'écarte sans bruit.
  const shown = await fetchPlayWhatsNew(PLAY_PACKAGE, log);
  let listed = null;
  if (shown) {
    listed = versionFromNotes(shown, 'changelogs/mobile.md', { format: 'play' });
    if (!listed && !versionFromNotes(shown, 'changelogs/tv.md', { format: 'play' })) {
      warn('Play : les notes de la fiche publique ne correspondent à aucun bloc de changelogs/mobile.md.');
    }
  }
  log(`Play téléphone : API ${reported.phone ?? '—'} · fiche publique ${listed ?? '—'} · TV : API ${reported.tv ?? '—'}`);

  // Les deux sources parlent : la plus basse. Une fiche en retard sur l'API
  // veut dire que la nouvelle version n'est pas encore servie à tout le monde.
  result.android = reported.phone && listed ? minVersion([reported.phone, listed]) : (reported.phone ?? listed);
  result.androidtv = reported.tv;
}

async function linux() {
  const manifest = JSON.parse(readFileSync('updates/store-versions.json', 'utf8'));
  result.linux = manifest.linux?.version ?? null;
  log(`Linux : ${result.linux ?? '—'} (manifeste)`);
}

async function githubReleases() {
  if (!/^[\w.-]+\/[\w.-]+$/.test(REPO)) throw new Error(`GITHUB_REPOSITORY invalide : ${REPO}`);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'tentacle-store-watch' };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`releases GitHub → ${r.status}`);
  const published = (await r.json()).filter((rel) => !rel.draft && !rel.prerelease);
  const latest = (prefix) =>
    maxVersion(published.map((rel) => String(rel.tag_name).match(new RegExp(`^${prefix}-v(\\d+\\.\\d+\\.\\d+)(?:-r\\d+)?$`))?.[1]));
  result.server = latest('server');
  result.webos = latest('webos');
  log(`GitHub : serveur ${result.server ?? '—'} · webOS ${result.webos ?? '—'}`);
}

const sources = { apple, windows, android, linux, githubReleases };
await Promise.all(
  Object.entries(sources).map(([name, run]) => run().catch((e) => warn(`${name} : ${why(e)}`))),
);

// Rien ne sort d'ici qui n'ait la forme exacte d'une version.
for (const key of Object.keys(result)) if (!isVersion(result[key])) result[key] = null;

const json = JSON.stringify(result);
if (out) writeFileSync(out, `${json}\n`);
else console.log(json);
if (Object.values(result).every((v) => v === null)) {
  console.error('[live] aucune source lisible');
  process.exit(1);
}
