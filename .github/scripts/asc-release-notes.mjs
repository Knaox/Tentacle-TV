// Remplit les notes de version sur App Store Connect depuis CHANGELOG.md (FR + EN).
// - « Nouveautés de cette version » (appStoreVersionLocalizations.whatsNew) : crée la
//   version App Store si besoin puis écrit les notes fr-FR + en-US.
// - « À tester » (betaBuildLocalizations.whatsNew — oui, même nom d'attribut que
//   les Nouveautés App Store ; « whatsToTest » n'existe pas → 409) : best-effort sur le build s'il
//   est déjà traité par Apple (sinon ignoré — asc-attach-build.mjs les re-pose après
//   traitement).
// NON BLOQUANT : toute erreur est loggée mais n'échoue pas le job (exit 0).
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8 (contenu .p8),
//   BUNDLE_ID, PLATFORM (MAC_OS|IOS|TV_OS), VERSION, BUILD, CHANGELOG (chemin).
// Env optionnel : CHANNEL (mac|ios|atv|win|play) — bloc « ## [<canal>-<version>] »
//   cherché en priorité (défaut dérivé de PLATFORM), repli « ## [<version>] ».
import { loadNotes } from './lib/changelog.mjs';
import {
  createAscClient, findApp, ensureAppStoreVersion, findBuild,
  setAppStoreNotes, setBetaBuildNotes, localePairs, CHANNEL_BY_PLATFORM,
} from './lib/asc-api.mjs';

const {
  ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
  PLATFORM = 'MAC_OS', VERSION, BUILD, CHANGELOG = 'CHANGELOG.md',
} = process.env;
const CHANNEL = process.env.CHANNEL || CHANNEL_BY_PLATFORM[PLATFORM] || null;

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });

const main = async () => {
  const notes = loadNotes({ changelog: CHANGELOG, channel: CHANNEL, version: VERSION, format: 'asc' });
  if (!notes || (!notes.fr && !notes.en)) {
    console.log(`[notes] pas de section CHANGELOG pour ${CHANNEL}-${VERSION} (ni ${VERSION}) — ignoré.`);
    return;
  }
  const pairs = localePairs(notes);

  const app = await findApp(api, BUNDLE_ID);

  // ── « Nouveautés » : version App Store (créée si absente) ──
  const ver = await ensureAppStoreVersion(api, app.id, { version: VERSION, platform: PLATFORM });
  await setAppStoreNotes(api, ver.id, pairs, (m) => console.log(`[notes] ${m}`));

  // ── « À tester » TestFlight : best-effort si le build est déjà traité ──
  try {
    const build = await findBuild(api, app.id, { build: BUILD, platform: PLATFORM });
    if (!build) { console.log(`[notes] build ${BUILD} pas encore traité par Apple — « À tester » posé par asc-attach-build après traitement.`); return; }
    await setBetaBuildNotes(api, build.id, pairs, (m) => console.log(`[notes] ${m}`));
  } catch (e) { console.log(`[notes] « À tester » échec (non bloquant): ${e.message}`); }
};

main().catch((e) => { console.log('[notes] erreur globale (non bloquant):', e.message); process.exit(0); });
