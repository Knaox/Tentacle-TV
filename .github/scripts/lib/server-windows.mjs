// Ce que fera une livraison de Tentacle Server pour Windows (server-windows.yml),
// décidé AVANT de rien construire. Aucune entrée/sortie ici : les faits du
// registre, l'écart des sources et les variables du dépôt arrivent en
// paramètres, et la décision se rejoue hors CI (test/server-windows.test.mjs).
//
// LA VERSION DE L'APP EST CELLE DU SERVEUR (décision du 2026-10-12). Plus de
// ligne à part : versions.json → server donne le paquet (S → MSIX S.0), le tag
// `server-windows-vS` et le bloc `## [S]` de changelogs/server-windows.md. Seule
// exception, la 1.0.0, construite à la main hors workflow : tout serveur livré
// depuis (≥ 1.27.0) la dépasse, et le Store exige un paquet strictement croissant.
// Ce workflow ne bumpe donc RIEN : la version, c'est server.yml qui l'écrit.
//
// LE PAQUET EMBARQUE LE SERVEUR, IL NE LE LIVRE PAS. Le serveur qu'il porte est
// celui de versions.json → server, construit depuis le commit figé (le moteur
// Prisma de Windows ne vient d'aucune image). Deux règles en découlent, les
// mêmes que celles de webOS face au serveur :
//   • au cran store, la production (`:latest`) doit DÉJÀ être ce serveur — sinon
//     le Store servirait à tous un serveur qui n'a été que testé ;
//   • le client LG servi sous /tv n'est jamais celui du commit : il est REPRIS
//     de l'image en service quand elle sert ce serveur (le client que voient
//     les téléviseurs aujourd'hui), sinon de l'image publiée « :vS ».
import { compareVersions, isVersion } from './versions.mjs';
import { LABELS, PlanError, liveServerVersion } from './server-image.mjs';

export const WINDOWS_CHANNELS = ['build', 'test', 'store'];

/** Où l'image range le client LG (Dockerfile : COPY --from=tv-client). */
export const TV_CLIENT_PATH = '/app/apps/tv-webos/client/dist';

/** Ce qui, dans l'arbre, devient le serveur embarqué (comparé à « :vS »). */
export const SERVER_PATHS = ['apps/backend', 'apps/web', 'packages', 'compat'];

/** Le tag qu'une livraison de l'app pose et accepte comme déclencheur. */
export const windowsTag = (version) => `server-windows-v${version}`;

const SHA_RE = /^[0-9a-f]{40}$/;
const short = (sha) => sha.slice(0, 8);
const DRIFT_SHOWN = 5;

/**
 * @param {object} p
 * @param {'build'|'test'|'store'} p.channel
 * @param {string} p.image          ex. ghcr.io/knaox/tentacle-tv
 * @param {string} p.sha            commit figé du run
 * @param {string} p.serverVersion  versions.json → server — ET la version de l'app
 * @param {string} [p.expectedVersion] la version demandée au lancement (entrée
 *   `version`, ou celle que server.yml vient de livrer) ; vide = celle de versions.json
 * @param {string} p.minServer      versions.json → minServer
 * @param {object} facts
 * @param {{digest:string, labels:object}|null} facts.production  `:latest`
 * @param {{digest:string, labels:object}|null} facts.base        `:v<server>`
 * @param {string[]|null} [facts.drift] fichiers du serveur qui diffèrent entre le
 *   commit qui a publié « :vS » et le commit figé ; null = comparaison impossible
 */
export function planWindowsPackage(p, { production, base, drift = null }) {
  if (!WINDOWS_CHANNELS.includes(p.channel)) {
    throw new PlanError(`cran « ${p.channel} » inconnu (${WINDOWS_CHANNELS.join('|')}) : l'app Windows n'a pas de cran dev.`);
  }
  if (!p.image) throw new PlanError('image manquante.');
  if (!SHA_RE.test(p.sha ?? '')) throw new PlanError(`SHA figé illisible : « ${p.sha} ».`);
  if (!isVersion(p.serverVersion)) throw new PlanError(`versions.json → server illisible : « ${p.serverVersion} ».`);
  if (!isVersion(p.minServer)) throw new PlanError(`versions.json → minServer illisible : « ${p.minServer} ».`);
  const S = p.serverVersion;
  // Rien ne se bumpe ici : la version demandée doit ÊTRE celle du serveur au
  // commit figé. Un écart, c'est un serveur pas encore livré, ou une faute de frappe.
  if (p.expectedVersion) {
    if (!isVersion(p.expectedVersion)) throw new PlanError(`version demandée illisible : « ${p.expectedVersion} ».`);
    if (p.expectedVersion !== S) {
      throw new PlanError(`Version demandée ${p.expectedVersion}, mais versions.json → server vaut ${S} à ce commit : `
        + 'la version de l\'app Windows EST celle du serveur, et ce workflow ne bumpe rien. Livre d\'abord le serveur '
        + `${p.expectedVersion} (server.yml, case « windows » pour enchaîner), ou laisse « version » vide.`);
    }
  }
  const W = S;

  // Le client web du paquet est compilé avec cette exigence : servi par un
  // serveur plus ancien, il afficherait lui-même « Serveur à mettre à jour ».
  if (compareVersions(p.minServer, S) > 0) {
    throw new PlanError(`Les clients de ce commit exigent un serveur ≥ ${p.minServer} (versions.json → minServer), mais `
      + `le paquet embarquerait le serveur ${S} (versions.json → server). Livre d'abord le serveur ${p.minServer}.`);
  }
  if (!base) {
    throw new PlanError(`Aucune image « ${p.image}:v${S} » : le serveur ${S} (versions.json → server) n'a jamais été `
      + `publié, même au cran test. L'app Windows embarque un serveur déjà livré : livre d'abord le serveur ${S} `
      + '(server.yml).');
  }

  const live = liveServerVersion(production, base, S);
  const notices = [];
  if (p.channel === 'store') {
    if (!production) {
      throw new PlanError(`Aucune image « ${p.image}:latest » : impossible de vérifier quel serveur est en service.`);
    }
    if (live !== S) {
      throw new PlanError(`L'image en service (:latest) est le serveur ${live || 'inconnu'}, pas ${S} : publier l'app `
        + `Windows au Store y mettrait le serveur ${S} en service avant Docker. Livre d'abord le serveur ${S} au cran `
        + 'store (server.yml) — ou l\'app Windows au cran test.');
    }
  }

  // Le client en service si la production sert CE serveur ; sinon celui que
  // « :vS » a figé à sa publication.
  const fromLatest = Boolean(production) && live === S;
  const source = fromLatest ? production : base;
  const clientFrom = fromLatest ? 'latest' : `v${S}`;
  const clientVersion = source.labels?.[LABELS.client] || '';
  if (!fromLatest) {
    notices.push({ level: 'notice', text: `« :latest » sert le serveur ${live || 'inconnu'}, pas ${S} : le client LG est `
      + `repris de « :v${S} », tel qu'il était à sa publication.` });
  }

  const serverRevision = base.labels?.[LABELS.revision] || '';
  if (!serverRevision) {
    notices.push({ level: 'notice', text: `« :v${S} » ne dit pas de quel commit il vient (image d'avant les labels) : `
      + 'impossible de comparer son serveur à celui du paquet.' });
  } else if (drift === null) {
    notices.push({ level: 'notice', text: `Le commit ${short(serverRevision)} qui a publié « :v${S} » n'est pas lisible ici : `
      + 'le serveur du paquet n\'a pas pu lui être comparé.' });
  } else if (drift.length > 0) {
    const shown = drift.slice(0, DRIFT_SHOWN).join(', ');
    const more = drift.length > DRIFT_SHOWN ? ` et ${drift.length - DRIFT_SHOWN} autre(s)` : '';
    notices.push({ level: 'warning', text: `Le serveur du paquet est construit depuis ${short(p.sha)}, pas depuis `
      + `${short(serverRevision)} qui a publié « :v${S} » : ${drift.length} fichier(s) du serveur diffèrent (${shown}${more}). `
      + `L'app annoncera le serveur ${S} avec ce code-là.` });
  }

  return {
    channel: p.channel,
    serverVersion: S,
    windowsVersion: W,
    // Le Store réserve le quatrième champ : il vaut toujours 0.
    msixVersion: `${W}.0`,
    tag: windowsTag(W),
    clientImage: `${p.image}@${source.digest}`,
    clientFrom,
    clientVersion,
    serverRevision,
    summary: `app ${W} (MSIX ${W}.0) = serveur ${S}, construit depuis ${short(p.sha)} · client LG `
      + `${clientVersion || 'non étiqueté'} repris de :${clientFrom} (${source.digest.slice(7, 19)})`,
    notices,
  };
}

/**
 * Où la soumission part, d'après les variables du dépôt. Rien au cran build ;
 * au cran test, un VOL de paquet (groupe de testeurs) ; au cran store, la fiche
 * publique. Une variable absente arrête le run AVANT le bump, pas après le build.
 */
export function storeTarget({ channel, storeId = '', flightId = '' }) {
  if (!WINDOWS_CHANNELS.includes(channel)) throw new PlanError(`cran « ${channel} » inconnu.`);
  if (channel === 'build') return null;
  if (!storeId) {
    throw new PlanError('La variable du dépôt SERVER_WINDOWS_STORE_ID n\'est pas posée : l\'ID Store de « Tentacle Server » '
      + '(Partner Center › Identité du produit, 12 caractères). À poser dans Settings › Secrets and variables › Actions › '
      + 'Variables. Le cran build, lui, ne soumet rien et reste possible.');
  }
  if (!/^[0-9A-Z]{12}$/.test(storeId)) {
    throw new PlanError(`SERVER_WINDOWS_STORE_ID illisible : « ${storeId} » (attendu : 12 caractères, ex. 9NKHL0T84245).`);
  }
  if (channel === 'store') return { storeId, flightId: '' };
  if (!flightId) {
    throw new PlanError('La variable du dépôt SERVER_WINDOWS_FLIGHT_ID n\'est pas posée : le cran test soumet à un VOL de '
      + 'paquet (Partner Center › l\'app › Vols de paquets), jamais à la fiche publique. Crée le vol, pose son ID, relance.');
  }
  if (!/^[0-9A-Za-z-]{1,64}$/.test(flightId)) {
    throw new PlanError(`SERVER_WINDOWS_FLIGHT_ID illisible : « ${flightId} ».`);
  }
  return { storeId, flightId };
}

/**
 * server.yml peut enchaîner l'app Windows (entrée `windows`), au MÊME cran et à
 * la MÊME version. Seulement aux crans test et store : au cran build, l'image
 * n'est pas publiée (« :vS » manquerait) ; au cran dev, jamais — `:dev` n'est
 * pas une livraison. Refusé AVANT le bump, plutôt qu'un run Windows qui
 * échouerait après la livraison du serveur.
 * @returns {boolean} true = déclencher server-windows.yml en fin de run
 */
export function windowsFollowUp({ channel, windows }) {
  if (!windows) return false;
  if (channel === 'test' || channel === 'store') return true;
  if (channel === 'build') {
    throw new PlanError('« windows » au cran build : l\'image du serveur n\'est pas publiée, l\'app Windows n\'aurait '
      + 'aucun « :vS » à embarquer. Décoche « windows », ou construis l\'app seule (server-windows.yml, cran build) '
      + 'sur un serveur déjà publié.');
  }
  throw new PlanError(`« windows » au cran ${channel || 'dev'} : l'app Windows ne suit que les livraisons test et store `
    + 'du serveur, jamais l\'image :dev.');
}
