#!/usr/bin/env node
// Interroge App Store Connect et imprime la version macOS REELLEMENT en ligne
// (etat READY_FOR_SALE — l'API expose aussi READY_FOR_DISTRIBUTION sur les
// comptes migres au nouveau vocabulaire, on accepte les deux).
//
// C'est la seule source fiable : iTunes Lookup renvoie la fiche iOS pour une
// app en achat universel (com.tentacle.mobile est partagee mac/iOS/tvOS), et
// c'est documente dans updates/store-versions.json. ASC, lui, fait autorite.
//
// Env requis : ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID.
// Sortie : la version (ex. « 1.13.1 ») sur stdout, rien d'autre — consommee
// par store-watch.yml. Exit 1 si aucune version macOS n'est en vente.
import { createAscClient, findApp } from './lib/asc-api.mjs';

const { ASC_KEY_ID, ASC_ISSUER, ASC_KEY_P8, BUNDLE_ID } = process.env;
if (!ASC_KEY_ID || !ASC_ISSUER || !ASC_KEY_P8 || !BUNDLE_ID) {
  console.error('[live] env ASC_KEY_ID/ASC_ISSUER/ASC_KEY_P8/BUNDLE_ID requis');
  process.exit(1);
}

// Vocabulaire moderne (appVersionState) : READY_FOR_DISTRIBUTION. L'ancien
// READY_FOR_SALE n'existe que dans appStoreState, champ DEPRECIE qu'Apple ne
// maintient plus de facon fiable : il peut rester fige a READY_FOR_SALE sur
// une version pourtant REPLACED_WITH_NEW_VERSION — d'ou la priorite absolue
// a appVersionState quand il est present (bug vu : 1.13.1 annoncee en vente
// alors que 1.15.0 etait en ligne).
const LIVE_STATES = new Set(['READY_FOR_SALE', 'READY_FOR_DISTRIBUTION']);

const api = createAscClient({ keyId: ASC_KEY_ID, issuer: ASC_ISSUER, p8: ASC_KEY_P8 });

const main = async () => {
  const app = await findApp(api, BUNDLE_ID);
  // Pas de filtre d'etat dans la requete : le nom du parametre varie selon la
  // generation de l'API (appStoreState vs appVersionState) — on filtre nous-
  // memes sur la reponse, robuste aux deux vocabulaires.
  const r = await api(
    'GET',
    `/v1/apps/${app.id}/appStoreVersions?filter[platform]=MAC_OS&limit=20`,
  );
  const versions = r.data ?? [];
  // Etat effectif : appVersionState fait foi ; appStoreState (deprecie) ne
  // sert de secours que s'il est absent de la reponse.
  const stateOf = (v) => v.attributes?.appVersionState ?? v.attributes?.appStoreState;
  console.error('[live] versions MAC_OS vues: '
    + versions.map((v) => `${v.attributes?.versionString}=${stateOf(v)}`).join(', '));
  const live = versions.find((v) => LIVE_STATES.has(stateOf(v)));
  if (!live) {
    console.error('[live] aucune version macOS en vente');
    process.exit(1);
  }
  process.stdout.write(String(live.attributes.versionString));
};

main().catch((e) => {
  console.error('[live] echec:', e instanceof Error ? e.message : e);
  process.exit(1);
});
