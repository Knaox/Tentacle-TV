#!/usr/bin/env node
// Imprime la version REELLEMENT en vente sur App Store Connect pour une
// plateforme (MAC_OS par defaut, IOS, TV_OS) : la plus haute en
// READY_FOR_DISTRIBUTION (ou READY_FOR_SALE, l'ancien vocabulaire).
//
// C'est la seule source fiable : iTunes Lookup renvoie la fiche iOS pour une
// app en achat universel (com.tentacle.mobile est partagee mac/iOS/tvOS), et
// c'est documente dans updates/store-versions.json. ASC, lui, fait autorite.
// Le veilleur (store-watch.yml) passe par store-live.mjs, qui fait la meme
// lecture (lib/asc-api.mjs → liveVersion) ; ce script reste l'outil a la main.
//
//   node .github/scripts/asc-live-version.mjs [--platform MAC_OS|IOS|TV_OS]
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID.
// Sortie : la version (ex. « 1.13.1 ») sur stdout, rien d'autre. Exit 1 si
// aucune version n'est en vente sur cette plateforme.
import { createAscClient, findApp, liveVersion } from './lib/asc-api.mjs';

const { ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER || !ASC_KEY_P8 || !BUNDLE_ID) {
  console.error('[live] env ASC_KEY_ID/ASC_ISSUER/ASC_KEY_P8/BUNDLE_ID requis');
  process.exit(1);
}
const i = process.argv.indexOf('--platform');
const platform = i >= 0 ? process.argv[i + 1] : 'MAC_OS';
if (!['MAC_OS', 'IOS', 'TV_OS'].includes(platform)) {
  console.error(`[live] --platform invalide : ${platform} (MAC_OS | IOS | TV_OS)`);
  process.exit(1);
}

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });

try {
  const app = await findApp(api, BUNDLE_ID);
  const live = await liveVersion(api, app.id, platform);
  if (!live) {
    console.error(`[live] aucune version ${platform} en vente`);
    process.exit(1);
  }
  process.stdout.write(live);
} catch (e) {
  console.error('[live] echec:', e instanceof Error ? e.message : e);
  process.exit(1);
}
