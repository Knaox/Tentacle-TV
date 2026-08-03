import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ce que la cible téléviseur remplace dans `apps/web`, et pourquoi.
 *
 * Données pures : aucune logique ici, le plugin de `substitutionModules.ts`
 * consomme cette table. Elle est le seul endroit du dépôt où l'on décrit ce
 * qui diffère entre le client web et le client téléviseur — c'est ce qui
 * permet à `apps/web` de ne contenir aucune condition de plateforme.
 *
 * Deux familles :
 *
 *   - les **paquets** (`framer-motion`, `hls.js`, `@tentacle-tv/plugins-api`),
 *     que `resolve.alias` saurait traiter ;
 *   - les **fichiers**, qu'il ne sait pas traiter. `resolve.alias` agit sur le
 *     spécificateur écrit dans l'import : il n'attrapera jamais le `./browser`
 *     relatif de `lib/deviceProfile/index.ts`. D'où la substitution par chemin
 *     résolu.
 */

// `fileURLToPath` et non `new URL(…).pathname` : ce dernier rend un chemin
// encodé pour URL, où le moindre espace du chemin du dépôt devient « %20 ».
// Aucune comparaison avec un identifiant résolu ne peut alors aboutir, et les
// substitutions passent silencieusement à côté de leur cible.
const ICI = dirname(fileURLToPath(import.meta.url));
const CIBLE = resolve(ICI, "..");
const WEB = resolve(CIBLE, "../web/src");
const UI = resolve(CIBLE, "../../packages/ui/src");
const CLIENT = resolve(CIBLE, "client/src");

/** Paquets npm remplacés — traités par `resolve.alias`. */
export const PAQUETS_SUBSTITUES: Record<string, string> = {
  // Le décodage passe par la puce de la dalle : faire transiter la vidéo par
  // JavaScript coûterait plus cher que tout ce qu'on pourrait gagner ailleurs.
  // Le stub répond `isSupported() → false`, et `useVideoSource` retombe alors
  // sur `video.src = url`, exactement le comportement voulu.
  "hls.js": resolve(CLIENT, "shims/hlsStub.ts"),
  // Animations pilotées en JavaScript sur un processeur de téléviseur : le
  // shim rend les éléments sans les animer, ce que la feuille TV compense en
  // CSS pur. Économise aussi 119 Ko à analyser au démarrage.
  "framer-motion": resolve(CLIENT, "shims/framerMotion.ts"),
  // Pas de marché de plugins sur un téléviseur.
  "@tentacle-tv/plugins-api": resolve(CLIENT, "shims/pluginsApi.ts"),
};

/** Fichiers remplacés — traités par le plugin de substitution. */
export const FICHIERS_SUBSTITUES: Record<string, string> = {
  // `main.tsx` est le bootstrap du client web : il pose `window.TentacleShared`
  // pour les plugins, monte le panneau de diagnostic et le cadre de fenêtre du
  // bureau. Le téléviseur a son propre point d'entrée ; les quinze modules qui
  // importent `backendUrl` d'ici n'ont besoin que de cette valeur.
  [resolve(WEB, "main.tsx")]: resolve(CLIENT, "shims/contexteApp.ts"),

  // Sort du graphe les écrans qui n'ont pas de sens sur un téléviseur. C'est
  // ce qui retire réellement leur code du bundle, sans toucher au routeur.
  [resolve(WEB, "lazyPages.ts")]: resolve(CLIENT, "pages/lazyPagesTv.ts"),

  // Les cartes du client web sont des `<div onClick>` sans `tabIndex` : elles
  // sont invisibles au moteur de navigation, et c'était le défaut numéro un —
  // sur vingt-sept éléments atteignables de l'accueil, aucun n'était une
  // carte. On substitue la RANGÉE et la carte de grille, qui enveloppent les
  // cartes du web sans les recopier. `ContinueWatchingRow` important la
  // rangée, l'accueil, la bibliothèque, la liste, les favoris et les extras de
  // fiche basculent d'un coup.
  [resolve(WEB, "components/rows/MediaRow.tsx")]: resolve(CLIENT, "ui/rangees/RangeeTv.tsx"),
  [resolve(WEB, "components/LibraryGridCard.tsx")]: resolve(CLIENT, "ui/cartes/CarteGrilleTv.tsx"),

  // La barre horizontale du web oblige à traverser tout l'écran pour changer
  // de section, et sa barre d'onglets mobile se déclenche sous 768 px. Le
  // téléviseur navigue par un rail latéral, toujours présent et déployé au
  // focus.
  [resolve(WEB, "components/AppLayout.tsx")]: resolve(CLIENT, "ui/DispositionTv.tsx"),

  // Les pastilles d'indicateur de la bannière sont des boutons de quatre pixels
  // de haut, posés sur le trajet du D-pad entre la bannière et la première
  // rangée. Viser une pastille n'apporte rien qu'un appui sur gauche ou droite
  // ne fasse déjà : elles restent affichées, mais cessent d'être des cibles.
  [resolve(WEB, "components/hero/HeroIndicators.tsx")]:
    resolve(CLIENT, "ui/heros/JaugeBanniereTv.tsx"),

  // Le profil d'appareil du téléviseur se compose des mêmes briques que celui
  // du navigateur, mais interroge `deviceInfo` en plus des sondes de codecs.
  // `construireProfil` de `usePlaybackInfo` n'est pas touché.
  [resolve(WEB, "lib/deviceProfile/browser.ts")]: resolve(CLIENT, "lecture/profilWebos.ts"),

  // Le HLS est toujours confié au moteur : la puce de la dalle décode le
  // manifeste, là où le client web a besoin de hls.js.
  [resolve(WEB, "hooks/useNativeHlsPreference.ts")]:
    resolve(CLIENT, "lecture/preferenceHlsNatif.ts"),

  // Hôte des plugins : une iframe qui charge un bundle distant.
  [resolve(WEB, "components/PluginIframe.tsx")]: resolve(CLIENT, "shims/pluginIframe.ts"),

  // Filtre SVG de réfraction du verre. Le flou d'arrière-plan est retiré de la
  // feuille TV, le filtre n'aurait plus rien à réfracter.
  [resolve(UI, "glass/GlassFilters.tsx")]: resolve(CLIENT, "shims/glassFilters.ts"),

  // Visionnage synchronisé : suppose un second écran et une saisie de texte.
  [resolve(WEB, "watchTogether/WatchTogetherProvider.tsx")]:
    resolve(CLIENT, "shims/watchTogether.ts"),

  // Téléchargements hors ligne : le stockage d'un téléviseur ne s'y prête pas.
  [resolve(WEB, "downloads/DownloadsEngineBoot.tsx")]: resolve(CLIENT, "shims/inerte.ts"),
  [resolve(WEB, "downloads/DownloadsEvents.tsx")]: resolve(CLIENT, "shims/inerte.ts"),

  // Outils de développement montés à la racine par `App.tsx`.
  [resolve(WEB, "dev/soakPlayer.tsx")]: resolve(CLIENT, "shims/harnaisDev.ts"),
  [resolve(WEB, "dev/autoWatch.tsx")]: resolve(CLIENT, "shims/harnaisDev.ts"),
  [resolve(WEB, "dev/FrameMeter.tsx")]: resolve(CLIENT, "shims/frameMeter.ts"),
};
