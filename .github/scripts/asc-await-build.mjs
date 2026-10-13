// Attend qu'un build uploadé soit traité par App Store Connect, puis pose son
// « À tester » TestFlight (le build doit être traité pour le recevoir). Échec
// réel → exit 1.
//
// AUCUNE VERSION APP STORE ICI. Le train TestFlight (preReleaseVersion) existe
// sans elle : un build se teste pendant qu'une AUTRE version est en examen —
// App Store Connect refuse alors d'en ouvrir une nouvelle (409), et le
// rattachement qui vivait ici bloquait la distribution TestFlight (macOS 1.28.1
// pendant l'examen de la 1.27.0, 2026-10-13). La version App Store n'est
// ouverte qu'au cran store, par asc-submit-review.mjs, qui y rattache le
// DERNIER build TestFlight de la version.
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
//   PLATFORM (MAC_OS|IOS|TV_OS), VERSION (marketing), BUILD (CFBundleVersion).
// Env optionnels : CHANNEL (notes, défaut dérivé de PLATFORM),
//   ATTACH_TIMEOUT_MINUTES (35), POLL_SECONDS (60), CHANGELOG (CHANGELOG.md).
import { loadNotes } from './lib/changelog.mjs';
import {
  createAscClient, findApp, findBuild, liveVersion,
  setBetaBuildNotes, localePairs, CHANNEL_BY_PLATFORM,
} from './lib/asc-api.mjs';

const {
  ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
  PLATFORM = 'MAC_OS', VERSION, BUILD, CHANGELOG = 'CHANGELOG.md',
} = process.env;
const CHANNEL = process.env.CHANNEL || CHANNEL_BY_PLATFORM[PLATFORM] || null;
const TIMEOUT_MS = Number(process.env.ATTACH_TIMEOUT_MINUTES ?? 35) * 60_000;
const POLL_MS = Number(process.env.POLL_SECONDS ?? 60) * 1000;

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  if (!VERSION || !BUILD) { console.error('[await] VERSION/BUILD manquants'); process.exit(1); }
  const app = await findApp(api, BUNDLE_ID);

  // 1) Attendre que le build (CFBundleVersion=BUILD) soit traité. Triple filtre
  //    indispensable : l'app com.tentacle.mobile est PARTAGÉE mac/iOS/tvOS — un
  //    même numéro de build peut exister sur plusieurs plateformes.
  const deadline = Date.now() + TIMEOUT_MS;
  let build;
  for (;;) {
    build = await findBuild(api, app.id, { build: BUILD, version: VERSION, platform: PLATFORM });
    const st = build?.attributes?.processingState; // PROCESSING|FAILED|INVALID|VALID
    if (st === 'VALID') break;
    if (st === 'FAILED' || st === 'INVALID') {
      console.error(`[await] build ${BUILD} → ${st} (voir l'email d'Apple).`);
      process.exit(1);
    }
    if (Date.now() > deadline) {
      console.error(`[await] timeout — build ${BUILD} ${st ?? 'pas encore visible sur ASC'}.`);
      process.exit(1);
    }
    console.log(`[await] build ${BUILD} (${VERSION}, ${PLATFORM}) : ${st ?? 'pas encore listé'} — nouvel essai dans ${POLL_MS / 1000}s`);
    await sleep(POLL_MS);
  }
  console.log(`[await] build ${BUILD} traité (VALID) — prêt pour TestFlight.`);

  // 2) « À tester » TestFlight, maintenant que le build est traité.
  try {
    // Ce qui est à tester depuis la version EN VENTE, versions sautées comprises.
    const since = await liveVersion(api, app.id, PLATFORM).catch(() => null);
    const notes = loadNotes({ changelog: CHANGELOG, channel: CHANNEL, version: VERSION, since, format: 'asc' });
    if (notes) await setBetaBuildNotes(api, build.id, localePairs(notes), (m) => console.log(`[await] ${m}`));
  } catch (e) { console.log(`[await] « À tester » échec (non bloquant): ${e.message}`); }
};

main().catch((e) => { console.error('[await] erreur:', e.message); process.exit(1); });
