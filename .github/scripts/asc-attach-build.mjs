// Attend qu'un build uploadé soit traité par App Store Connect, puis le
// RATTACHE à la version App Store (créée si besoin) → il ne reste qu'à cliquer
// « Soumettre pour examen » sur ASC. Re-pose aussi « À tester » TestFlight
// (le passage du script notes, juste après l'upload, arrive presque toujours
// trop tôt). Échec réel → exit 1 (le job YAML est continue-on-error : croix
// visible, run global vert).
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
//   PLATFORM (MAC_OS|IOS|TV_OS), VERSION (marketing), BUILD (CFBundleVersion).
// Env optionnels : CHANNEL (notes, défaut dérivé de PLATFORM),
//   ATTACH_TIMEOUT_MINUTES (35), POLL_SECONDS (60), CHANGELOG (CHANGELOG.md).
import { loadNotes } from './lib/changelog.mjs';
import { createAscClient, findApp, ensureAppStoreVersion } from './lib/asc-api.mjs';

const {
  ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
  PLATFORM = 'MAC_OS', VERSION, BUILD, CHANGELOG = 'CHANGELOG.md',
} = process.env;
const CHANNEL = process.env.CHANNEL || { MAC_OS: 'mac', IOS: 'ios', TV_OS: 'atv' }[PLATFORM] || null;
const TIMEOUT_MS = Number(process.env.ATTACH_TIMEOUT_MINUTES ?? 35) * 60_000;
const POLL_MS = Number(process.env.POLL_SECONDS ?? 60) * 1000;

// États d'une version App Store où le build est encore modifiable.
const EDITABLE_STATES = new Set([
  'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY',
]);

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  if (!VERSION || !BUILD) { console.error('[attach] VERSION/BUILD manquants'); process.exit(1); }
  const app = await findApp(api, BUNDLE_ID);

  // 1) Attendre que le build (CFBundleVersion=BUILD) soit traité. Triple filtre
  //    indispensable : l'app com.tentacle.mobile est PARTAGÉE mac/iOS/tvOS — un
  //    même numéro de build peut exister sur plusieurs plateformes.
  const deadline = Date.now() + TIMEOUT_MS;
  let build;
  for (;;) {
    const r = await api('GET',
      `/v1/builds?filter[app]=${app.id}` +
      `&filter[version]=${BUILD}` +
      `&filter[preReleaseVersion.version]=${VERSION}` +
      `&filter[preReleaseVersion.platform]=${PLATFORM}` +
      `&sort=-uploadedDate&limit=1`);
    build = r.data?.[0];
    const st = build?.attributes?.processingState; // PROCESSING|FAILED|INVALID|VALID
    if (st === 'VALID') break;
    if (st === 'FAILED' || st === 'INVALID') {
      console.error(`[attach] build ${BUILD} → ${st} (voir l'email d'Apple).`);
      process.exit(1);
    }
    if (Date.now() > deadline) {
      console.error(`[attach] timeout — build ${BUILD} ${st ?? 'pas encore visible sur ASC'} ; rattacher à la main dans App Store Connect.`);
      process.exit(1);
    }
    console.log(`[attach] build ${BUILD} (${VERSION}, ${PLATFORM}) : ${st ?? 'pas encore listé'} — nouvel essai dans ${POLL_MS / 1000}s`);
    await sleep(POLL_MS);
  }
  console.log(`[attach] build ${BUILD} traité (VALID).`);

  // 2) Version App Store (créée si absente) + garde-fou d'état.
  const ver = await ensureAppStoreVersion(api, app.id, { version: VERSION, platform: PLATFORM });
  const state = ver.attributes?.appVersionState ?? ver.attributes?.appStoreState;
  if (state && !EDITABLE_STATES.has(state)) {
    console.error(`[attach] version ${VERSION} (${PLATFORM}) en état « ${state} » — non éditable, rattachement ignoré.`);
    process.exit(1);
  }

  // 3) Rattachement du build à la version.
  await api('PATCH', `/v1/appStoreVersions/${ver.id}/relationships/build`,
    { data: { type: 'builds', id: build.id } });
  console.log(`[attach] build ${BUILD} rattaché à la version ${VERSION} (${PLATFORM}) ✓ — il ne reste qu'à « Soumettre pour examen ».`);

  // 4) Bonus : « À tester » TestFlight, maintenant que le build est traité.
  try {
    const notes = loadNotes({ changelog: CHANGELOG, channel: CHANNEL, version: VERSION, format: 'asc' });
    if (notes) {
      const bl = await api('GET', `/v1/builds/${build.id}/betaBuildLocalizations?limit=50`);
      for (const [locale, text] of [['fr-FR', notes.fr], ['en-US', notes.en]]) {
        if (!text) continue;
        const existing = bl.data.find((l) => l.attributes.locale === locale);
        if (existing) await api('PATCH', `/v1/betaBuildLocalizations/${existing.id}`, { data: { type: 'betaBuildLocalizations', id: existing.id, attributes: { whatsNew: text } } });
        else await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale, whatsNew: text }, relationships: { build: { data: { type: 'builds', id: build.id } } } } });
        console.log(`[attach] « À tester » ${locale} ✓`);
      }
    }
  } catch (e) { console.log(`[attach] « À tester » échec (non bloquant): ${e.message}`); }
};

main().catch((e) => { console.error('[attach] erreur:', e.message); process.exit(1); });
