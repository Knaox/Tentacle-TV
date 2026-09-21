// Soumet une version App Store à l'examen, et la met en vente TOUTE SEULE dès
// l'approbation — le dernier geste manuel du cran « store » côté Apple.
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
//   PLATFORM (MAC_OS|IOS|TV_OS), VERSION (marketing).
// Env optionnel : RELEASE_TYPE (AFTER_APPROVAL par défaut ; MANUAL pour garder
//   la main sur l'instant de la mise en vente).
//
// LE FLUX EN TROIS TEMPS. `appStoreVersionSubmissions` n'existe plus : on ouvre
// un `reviewSubmission` VIDE pour l'app, on y met la version comme
// `reviewSubmissionItem`, puis on passe `submitted: true`. L'ordre est imposé —
// un PATCH avant d'avoir ajouté l'article renvoie 422.
//
// IDEMPOTENT. Une soumission déjà ouverte (READY_FOR_REVIEW) est RÉUTILISÉE :
// en poster une seconde donne 409. Et une version déjà partie en examen ou
// déjà en vente est un succès, pas une erreur — c'est le cas d'un run rejoué.
//
// BLOQUANT, contrairement aux scripts de notes : c'est la raison d'être du
// cran « store ». Un échec silencieux laisserait croire que c'est publié.
import {
  createAscClient, findApp, ensureAppStoreVersion,
  EDITABLE_VERSION_STATES, SUBMITTED_VERSION_STATES, versionState,
} from './lib/asc-api.mjs';

const {
  ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
  PLATFORM = 'MAC_OS', VERSION, RELEASE_TYPE = 'AFTER_APPROVAL',
} = process.env;

if (!VERSION) { console.error('::error::VERSION manquant.'); process.exit(1); }

// Une soumission ENCORE OUVERTE, à réutiliser plutôt qu'à doubler : il ne peut
// y en avoir qu'une par plateforme et par app, et en poster une seconde donne
// 409. « UNRESOLVED_ISSUES » n'en fait PAS partie — c'est une soumission déjà
// partie qu'Apple a renvoyée avec des questions ; la rouvrir d'ici n'aurait
// aucun sens.
const REUSABLE_SUBMISSION_STATES = new Set(['READY_FOR_REVIEW']);
const IN_FLIGHT_SUBMISSION_STATES = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW', 'UNRESOLVED_ISSUES']);

const READY_WAIT_MS = Number(process.env.READY_TIMEOUT_MINUTES ?? 10) * 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });

const main = async () => {
  const app = await findApp(api, BUNDLE_ID);
  const ver = await ensureAppStoreVersion(api, app.id, { version: VERSION, platform: PLATFORM });
  const state = versionState(ver);

  if (state && SUBMITTED_VERSION_STATES.has(state)) {
    console.log(`[review] ${VERSION} (${PLATFORM}) est déjà en « ${state} » — rien à soumettre.`);
    return;
  }
  if (state && !EDITABLE_VERSION_STATES.has(state)) {
    console.error(`::error::${VERSION} (${PLATFORM}) est en « ${state} » — ni éditable ni déjà soumise. Regarde App Store Connect.`);
    process.exit(1);
  }

  // 1) Mise en vente automatique à l'approbation.
  await api('PATCH', `/v1/appStoreVersions/${ver.id}`, {
    data: { type: 'appStoreVersions', id: ver.id, attributes: { releaseType: RELEASE_TYPE } },
  });
  console.log(`[review] releaseType = ${RELEASE_TYPE}.`);

  // 2) Une soumission ouverte, réutilisée ou créée. Pas de filter[state] dans
  //    la requête : le nom du paramètre a changé d'une génération d'API à
  //    l'autre, on trie côté client (même choix que asc-live-version.mjs).
  const open = await api('GET', `/v1/apps/${app.id}/reviewSubmissions?filter[platform]=${PLATFORM}&limit=50`);
  const inFlight = (open.data ?? []).find((s) => IN_FLIGHT_SUBMISSION_STATES.has(s.attributes?.state));
  if (inFlight) {
    console.log(`[review] une soumission est déjà en cours (${inFlight.attributes.state}) — rien à envoyer.`);
    return;
  }
  let submission = (open.data ?? []).find((s) => REUSABLE_SUBMISSION_STATES.has(s.attributes?.state));
  if (submission) {
    console.log(`[review] soumission ${submission.id} déjà ouverte (${submission.attributes.state}) — réutilisée.`);
  } else {
    submission = (await api('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: { platform: PLATFORM },
        relationships: { app: { data: { type: 'apps', id: app.id } } },
      },
    })).data;
    console.log(`[review] soumission ${submission.id} ouverte.`);
  }

  // 3) La version dans la soumission (une seule fois).
  const items = await api('GET', `/v1/reviewSubmissions/${submission.id}/items?limit=50`);
  const already = (items.data ?? []).some((i) => i.relationships?.appStoreVersion?.data?.id === ver.id);
  if (already) {
    console.log(`[review] la version ${VERSION} est déjà dans la soumission.`);
  } else {
    await api('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } },
        },
      },
    });
    console.log(`[review] version ${VERSION} ajoutée à la soumission.`);
  }

  // 4) Attendre que la version soit « READY_FOR_REVIEW ». App Store Connect
  //    valide les métadonnées après le rattachement du build, et un envoi
  //    pendant cette validation est refusé.
  const deadline = Date.now() + READY_WAIT_MS;
  for (;;) {
    const now = versionState((await api('GET', `/v1/appStoreVersions/${ver.id}`)).data);
    if (now === 'READY_FOR_REVIEW') break;
    if (now && SUBMITTED_VERSION_STATES.has(now)) {
      console.log(`[review] la version est passée en « ${now} » d'elle-même — rien à envoyer.`);
      return;
    }
    if (Date.now() > deadline) {
      console.error(`::error::la version ${VERSION} est restée en « ${now} » : App Store Connect ne la juge pas prête (métadonnée manquante ?).`);
      process.exit(1);
    }
    console.log(`[review] version en « ${now} » — on attend « READY_FOR_REVIEW »…`);
    await sleep(30_000);
  }

  // 5) Envoi.
  await api('PATCH', `/v1/reviewSubmissions/${submission.id}`, {
    data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } },
  });
  console.log(`[review] ${VERSION} (${PLATFORM}) soumise à l'examen ✓ — mise en vente ${RELEASE_TYPE === 'AFTER_APPROVAL' ? 'automatique à l\'approbation' : 'manuelle'}.`);
};

main().catch((e) => {
  console.error(`::error::soumission à l'examen impossible : ${e.message}`);
  console.error("Une version incomplète (captures, classification, conformité chiffrement) est refusée par l'API comme par la console.");
  process.exit(1);
});
