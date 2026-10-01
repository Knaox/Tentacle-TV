// Ce que fera une livraison de l'image serveur, décidé AVANT de rien
// construire, à partir de l'état du registre. Aucune entrée/sortie ici : les
// faits du registre arrivent en paramètres, et la décision se rejoue hors CI.
//
// L'IMAGE A DEUX MOITIÉS, et chaque workflow ne livre que la sienne :
//
//   • mode « server » (server.yml) — le serveur est construit depuis les
//     sources ; le client LG est REPRIS de l'image en service (`:latest`),
//     jamais celui du commit. Une livraison serveur ne change donc pas ce que
//     voient les téléviseurs.
//   • mode « webos » (webos.yml) — le client LG vient d'être construit ; il est
//     posé sur l'image déjà publiée du serveur (`:vX.Y.Z`, celle de
//     versions.json → server), qui reste la même à l'octet près.
//
// Deux garde-fous que seul le registre permet de poser :
//   • au cran store, webos.yml refuse de basculer `:latest` si la production
//     n'est pas DÉJÀ le serveur de versions.json — sinon il mettrait en
//     service, sous couvert du client LG, un serveur qui n'a été que testé ;
//   • `expectLatest` : l'empreinte de `:latest` lue ici. Le job qui bascule
//     `:latest` la relit juste avant d'écrire, et refuse si elle a changé —
//     une livraison serveur et une livraison webOS simultanées ne peuvent
//     plus s'écraser l'une l'autre en silence.
import { compareVersions, isVersion } from './versions.mjs';

/** Les labels posés sur chaque image (les clés sont lues par ce module même). */
export const LABELS = {
  version: 'org.opencontainers.image.version',
  revision: 'org.opencontainers.image.revision',
  client: 'app.tentacletv.webos-client',
  clientRevision: 'app.tentacletv.webos-client.revision',
};

export const MODES = ['server', 'webos'];
export const CHANNELS = ['build', 'test', 'store'];

/** Une décision impossible : le message dit pourquoi et quoi faire. */
export class PlanError extends Error {}

const SHA_RE = /^[0-9a-f]{40}$/;

/** L'étiquette dédiée d'une reconstruction webOS : le serveur, puis le client. */
export const webosTag = (server, webos) => `v${server}-webos-${webos}`;

/**
 * @param {object} p
 * @param {'server'|'webos'} p.mode
 * @param {'build'|'test'|'store'} p.channel
 * @param {string} p.image         ex. ghcr.io/knaox/tentacle-tv
 * @param {string} p.sha           commit figé du run
 * @param {string} p.serverVersion versions.json → server
 * @param {string} [p.webosVersion] versions.json → webos
 * @param {string} [p.minServer]   versions.json → minServer (mode webos)
 * @param {string} [p.clientDir]   répertoire du client construit (mode webos)
 * @param {object} registry
 * @param {{digest:string, labels:object}|null} registry.production  `:latest`
 * @param {{digest:string, labels:object}|null} [registry.base]      `:v<server>`
 */
export function planServerImage(p, { production, base = null }) {
  if (!MODES.includes(p.mode)) throw new PlanError(`mode « ${p.mode} » inconnu (${MODES.join('|')}).`);
  if (!CHANNELS.includes(p.channel)) throw new PlanError(`cran « ${p.channel} » inconnu (${CHANNELS.join('|')}).`);
  if (!p.image) throw new PlanError('image manquante.');
  if (!SHA_RE.test(p.sha ?? '')) throw new PlanError(`SHA figé illisible : « ${p.sha} ».`);
  if (!isVersion(p.serverVersion)) throw new PlanError(`version serveur illisible : « ${p.serverVersion} ».`);
  return p.mode === 'server' ? planServer(p, production) : planWebos(p, production, base);
}

function planServer(p, production) {
  const S = p.serverVersion;
  if (!production) {
    throw new PlanError(`Aucune image « ${p.image}:latest » : c'est d'elle que le serveur reprend le client LG `
      + 'en service, et il ne livre jamais celui du commit. Rétablis « :latest » '
      + '(docker buildx imagetools create -t …:latest …:vX.Y.Z), puis relance.');
  }
  const clientVersion = production.labels?.[LABELS.client] || '';
  const clientRevision = production.labels?.[LABELS.clientRevision] || '';
  const notices = [];
  if (!clientVersion) {
    notices.push({ level: 'notice', text: 'Le client LG en service n\'est pas étiqueté (image antérieure à la livraison '
      + 'webOS séparée) : il est repris tel quel, sans numéro.' });
  } else if (isVersion(p.webosVersion) && p.webosVersion !== clientVersion) {
    notices.push({ level: 'warning', text: `versions.json → webos vaut ${p.webosVersion}, mais l'image en service porte le `
      + `client LG ${clientVersion} : le serveur garde ${clientVersion}. (webOS ${p.webosVersion} n'a été livré qu'au cran `
      + 'test, ou pas encore : c\'est le cran store de webos.yml qui le met en service.)' });
  }
  const clientText = clientVersion
    ? `${clientVersion}, inchangé — celui de l'image en service`
    : 'inchangé — celui de l\'image en service (non étiqueté : antérieur à la livraison webOS séparée)';

  const tags = { build: [], test: [`v${S}`], store: [`v${S}`, 'latest'] }[p.channel];
  return {
    mode: 'server',
    channel: p.channel,
    image: p.image,
    push: p.channel !== 'build',
    serverVersion: S,
    clientVersion,
    tags,
    // L'étape qui construirait le client depuis les sources est remplacée par
    // l'image en service, ÉPINGLÉE : les deux architectures lisent la même.
    contexts: [`tv-client-build=docker-image://${p.image}@${production.digest}`],
    labels: {
      [LABELS.version]: S,
      [LABELS.revision]: p.sha,
      [LABELS.client]: clientVersion,
      [LABELS.clientRevision]: clientRevision,
    },
    expectLatest: p.channel === 'store' ? production.digest : '',
    release: p.channel !== 'store' ? null : {
      tag: `server-v${S}`,
      title: `Tentacle TV Server v${S}`,
      changelog: 'changelogs/server.md',
      version: S,
      latest: true,
      header: [
        `Image Docker : \`${p.image}:v${S}\` (et \`:latest\`).`,
        '',
        `Client LG webOS servi sous \`/tv\` : ${clientText}.`,
      ],
    },
    summary: `serveur ${S} construit depuis ${p.sha.slice(0, 8)} · client LG ${clientVersion || 'non étiqueté'} repris de `
      + `:latest (${production.digest.slice(7, 19)})`,
    notices,
  };
}

function planWebos(p, production, base) {
  const S = p.serverVersion;
  const W = p.webosVersion;
  if (!isVersion(W)) throw new PlanError(`version webOS illisible : « ${W} ».`);
  if (!isVersion(p.minServer)) throw new PlanError(`minServer illisible : « ${p.minServer} ».`);
  if (!p.clientDir) throw new PlanError('répertoire du client LG manquant.');

  // Le client est compilé avec cette exigence (__MIN_SERVER_VERSION__) : servi
  // par un serveur plus ancien, il afficherait lui-même l'alerte de
  // compatibilité, ou appellerait des routes qui n'existent pas encore.
  if (compareVersions(p.minServer, S) > 0) {
    throw new PlanError(`Le client LG de ce commit exige un serveur ≥ ${p.minServer} (versions.json → minServer), mais `
      + `l'image reconstruite reste le serveur ${S} (versions.json → server). Livre d'abord le serveur `
      + `${p.minServer} (server.yml), puis webOS.`);
  }
  if (!base) {
    throw new PlanError(`Aucune image « ${p.image}:v${S} » : le serveur ${S} (versions.json → server) n'a jamais été `
      + `publié, même au cran test. webOS se pose sur l'image livrée du serveur : livre d'abord le serveur ${S}.`);
  }

  const notices = [];
  if (p.channel === 'store') {
    if (!production) {
      throw new PlanError(`Aucune image « ${p.image}:latest » : impossible de vérifier quel serveur est en service.`);
    }
    // Une image étiquetée dit son serveur ; une image d'avant les labels se
    // reconnaît à son empreinte, identique à celle de « :vS » (server.yml pose
    // les deux étiquettes d'un même geste).
    const live = production.labels?.[LABELS.version] || (production.digest === base.digest ? S : '');
    if (live !== S) {
      throw new PlanError(`L'image en service (:latest) est le serveur ${live || 'inconnu'}, pas ${S} : livrer webOS au `
        + `cran store y mettrait le serveur ${S} en service à sa place. Livre d'abord le serveur ${S} au cran store `
        + '(server.yml) — ou webOS au cran test.');
    }
  } else {
    notices.push({ level: 'notice', text: `Cran ${p.channel} : « :latest » ne bouge pas, les téléviseurs gardent le client `
      + 'en service.' });
  }

  const dedicated = webosTag(S, W);
  const tags = { build: [], test: [dedicated], store: [dedicated, 'latest'] }[p.channel];
  return {
    mode: 'webos',
    channel: p.channel,
    image: p.image,
    push: p.channel !== 'build',
    serverVersion: S,
    clientVersion: W,
    tags,
    contexts: [
      // Le serveur n'est PAS reconstruit : c'est l'image publiée, épinglée.
      `server=docker-image://${p.image}@${base.digest}`,
      `tv-client=${p.clientDir}`,
    ],
    // `revision` n'est pas reposé : il reste, hérité, celui du serveur.
    labels: {
      [LABELS.version]: S,
      [LABELS.client]: W,
      [LABELS.clientRevision]: p.sha,
    },
    expectLatest: p.channel === 'store' ? production.digest : '',
    release: p.channel !== 'store' ? null : {
      tag: `server-${dedicated}`,
      title: `Tentacle TV Server v${S} — client LG webOS ${W}`,
      changelog: 'changelogs/server-webos.md',
      version: W,
      // Une reconstruction ne vole pas « Latest » à une vraie version.
      latest: false,
      header: [
        `Image Docker : \`${p.image}:${dedicated}\` (et \`:latest\`) — le serveur ${S}, inchangé, avec le client LG `
          + `webOS ${W} servi sous \`/tv\`.`,
      ],
    },
    summary: `serveur ${S} repris de :v${S} (${base.digest.slice(7, 19)}) · client LG ${W} construit depuis `
      + p.sha.slice(0, 8),
    notices,
  };
}
