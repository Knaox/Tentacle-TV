// Remplit les notes de version sur App Store Connect depuis CHANGELOG.md (FR + EN).
// - « Nouveautés de cette version » (appStoreVersionLocalizations.whatsNew) : crée la
//   version App Store si besoin puis écrit les notes fr-FR + en-US.
// - « À tester » (betaBuildLocalizations.whatsToTest) : best-effort sur le build s'il
//   est déjà traité par Apple (sinon ignoré — asc-attach-build.mjs les re-pose après
//   traitement).
// NON BLOQUANT : toute erreur est loggée mais n'échoue pas le job (exit 0).
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8 (contenu .p8),
//   BUNDLE_ID, PLATFORM (MAC_OS|IOS|TV_OS), VERSION, BUILD, CHANGELOG (chemin).
// Env optionnel : CHANNEL (mac|ios|atv|win|play) — bloc « ## [<canal>-<version>] »
//   cherché en priorité (défaut dérivé de PLATFORM), repli « ## [<version>] ».
import { loadNotes, LIMITS } from './lib/changelog.mjs';
import { createAscClient, findApp, ensureAppStoreVersion } from './lib/asc-api.mjs';

const {
  ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID,
  PLATFORM = 'MAC_OS', VERSION, BUILD, CHANGELOG = 'CHANGELOG.md',
} = process.env;
const CHANNEL = process.env.CHANNEL || { MAC_OS: 'mac', IOS: 'ios', TV_OS: 'atv' }[PLATFORM] || null;

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });

const main = async () => {
  const notes = loadNotes({ changelog: CHANGELOG, channel: CHANNEL, version: VERSION, format: 'asc' });
  if (!notes || (!notes.fr && !notes.en)) {
    console.log(`[notes] pas de section CHANGELOG pour ${CHANNEL}-${VERSION} (ni ${VERSION}) — ignoré.`);
    return;
  }
  const locales = [['fr-FR', notes.fr], ['en-US', notes.en]].filter(([, t]) => t);

  const app = await findApp(api, BUNDLE_ID);

  // ── « Nouveautés » : version App Store (créée si absente) ──
  const ver = await ensureAppStoreVersion(api, app.id, { version: VERSION, platform: PLATFORM });
  const locs = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations?limit=50`);
  for (const [locale, text] of locales) {
    const existing = locs.data.find((l) => l.attributes.locale === locale);
    try {
      if (existing) await api('PATCH', `/v1/appStoreVersionLocalizations/${existing.id}`, { data: { type: 'appStoreVersionLocalizations', id: existing.id, attributes: { whatsNew: text } } });
      else await api('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale, whatsNew: text }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } } });
      console.log(`[notes] « Nouveautés » ${locale} ✓ (${text.length}/${LIMITS.asc} car.)`);
    } catch (e) { console.log(`[notes] whatsNew ${locale} échec (non bloquant): ${e.message}`); }
  }

  // ── « À tester » TestFlight : best-effort si le build est déjà traité ──
  try {
    const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&filter[version]=${BUILD}&filter[preReleaseVersion.platform]=${PLATFORM}&limit=1`);
    const build = builds.data?.[0];
    if (!build) { console.log(`[notes] build ${BUILD} pas encore traité par Apple — « À tester » posé par asc-attach-build après traitement.`); return; }
    const bl = await api('GET', `/v1/builds/${build.id}/betaBuildLocalizations?limit=50`);
    for (const [locale, text] of locales) {
      const existing = bl.data.find((l) => l.attributes.locale === locale);
      if (existing) await api('PATCH', `/v1/betaBuildLocalizations/${existing.id}`, { data: { type: 'betaBuildLocalizations', id: existing.id, attributes: { whatsToTest: text } } });
      else await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale, whatsToTest: text }, relationships: { build: { data: { type: 'builds', id: build.id } } } } });
      console.log(`[notes] « À tester » ${locale} ✓`);
    }
  } catch (e) { console.log(`[notes] whatsToTest échec (non bloquant): ${e.message}`); }
};

main().catch((e) => { console.log('[notes] erreur globale (non bloquant):', e.message); process.exit(0); });
