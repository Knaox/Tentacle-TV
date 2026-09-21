// Distribue un build TestFlight au groupe de test, et l'envoie à l'examen bêta
// si le groupe est EXTERNE — c'est ce qui rend le cran « test » réellement
// automatique côté Apple. Sans ça, le build reste visible dans TestFlight mais
// n'atteint personne.
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
//   PLATFORM (MAC_OS|IOS|TV_OS), VERSION (marketing), BUILD (CFBundleVersion).
// Env optionnel : ASC_BETA_GROUP (nom) ou ASC_BETA_GROUP_ID.
//   Ni l'un ni l'autre : on prend le groupe externe s'il n'y en a qu'UN SEUL.
//   Zéro ou plusieurs → échec, avec la liste des groupes pour choisir.
//
// IDEMPOTENT : un build déjà dans le groupe, ou déjà en examen bêta, est un
// succès. C'est le cas d'un run rejoué.
import { createAscClient, findApp, findBuild } from './lib/asc-api.mjs';

const {
  ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
  PLATFORM = 'IOS', VERSION, BUILD,
  ASC_BETA_GROUP, ASC_BETA_GROUP_ID,
} = process.env;

if (!VERSION || !BUILD) { console.error('::error::VERSION/BUILD manquants.'); process.exit(1); }

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });

/** Une 409 « existe déjà » n'est pas un échec : le run a déjà fait le geste. */
const alreadyDone = (e) => / 409 |ENTITY_ERROR|already|STATE_ERROR/i.test(e.message);

function pickGroup(groups) {
  if (ASC_BETA_GROUP_ID) {
    const byId = groups.find((g) => g.id === ASC_BETA_GROUP_ID);
    if (!byId) throw new Error(`aucun groupe d'identifiant ${ASC_BETA_GROUP_ID}.`);
    return byId;
  }
  if (ASC_BETA_GROUP) {
    const byName = groups.find((g) => g.attributes?.name === ASC_BETA_GROUP);
    if (!byName) throw new Error(`aucun groupe nommé « ${ASC_BETA_GROUP} ».`);
    return byName;
  }
  const external = groups.filter((g) => g.attributes?.isInternalGroup === false);
  if (external.length === 1) {
    console.log(`[testflight] un seul groupe externe — « ${external[0].attributes.name} » retenu d'office.`);
    return external[0];
  }
  throw new Error(
    external.length === 0
      ? "aucun groupe de test EXTERNE sur cette fiche. Crée-en un dans TestFlight, puis pose son identifiant dans le secret ASC_BETA_GROUP_ID."
      : `${external.length} groupes externes — précise lequel via ASC_BETA_GROUP_ID ou ASC_BETA_GROUP.`);
}

const main = async () => {
  const app = await findApp(api, BUNDLE_ID);
  const build = await findBuild(api, app.id, { build: BUILD, version: VERSION, platform: PLATFORM });
  if (!build) {
    console.error(`::error::build ${BUILD} (${VERSION}, ${PLATFORM}) introuvable sur App Store Connect.`);
    process.exit(1);
  }

  const all = (await api('GET', `/v1/betaGroups?filter[app]=${app.id}&limit=200`)).data ?? [];
  console.log(`[testflight] groupes de la fiche : ${all.map((g) => `${g.attributes?.name}${g.attributes?.isInternalGroup ? ' (interne)' : ''}`).join(', ') || 'aucun'}`);

  let group;
  try {
    group = pickGroup(all);
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
  const external = group.attributes?.isInternalGroup === false;

  // Le sens builds → betaGroups, celui qu'emploie fastlane.
  try {
    await api('POST', `/v1/builds/${build.id}/relationships/betaGroups`, {
      data: [{ type: 'betaGroups', id: group.id }],
    });
    console.log(`[testflight] build ${BUILD} distribué au groupe « ${group.attributes.name} » ✓`);
  } catch (e) {
    if (!alreadyDone(e)) throw e;
    console.log(`[testflight] build ${BUILD} était déjà dans « ${group.attributes.name} ».`);
  }

  if (!external) {
    console.log("[testflight] groupe interne — pas d'examen bêta à demander.");
    return;
  }

  // Apple envoie normalement le build à l'examen bêta dès son ajout à un
  // groupe externe ; on le demande explicitement au cas où, et une 409 dit
  // simplement que c'était déjà fait.
  try {
    await api('POST', '/v1/betaAppReviewSubmissions', {
      data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } },
    });
    console.log(`[testflight] build ${BUILD} envoyé à l'examen bêta ✓`);
  } catch (e) {
    if (!alreadyDone(e)) throw e;
    console.log(`[testflight] examen bêta déjà demandé pour le build ${BUILD}.`);
  }
};

main().catch((e) => {
  console.error(`::error::distribution TestFlight impossible : ${e.message}`);
  process.exit(1);
});
