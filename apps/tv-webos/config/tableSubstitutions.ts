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
  [resolve(WEB, "lazyPages.ts")]: resolve(CLIENT, "pages/lazyPagesTv.tsx"),

  // Les cartes du client web sont des `<div onClick>` sans `tabIndex` : elles
  // sont invisibles au moteur de navigation, et c'était le défaut numéro un —
  // sur vingt-sept éléments atteignables de l'accueil, aucun n'était une
  // carte. On substitue la RANGÉE et la carte de grille, qui enveloppent les
  // cartes du web sans les recopier. `ContinueWatchingRow` important la
  // rangée, l'accueil, la bibliothèque, la liste, les favoris et les extras de
  // fiche basculent d'un coup.
  [resolve(WEB, "components/rows/MediaRow.tsx")]: resolve(CLIENT, "ui/rangees/RangeeTv.tsx"),
  [resolve(WEB, "components/LibraryGridCard.tsx")]: resolve(CLIENT, "ui/cartes/CarteGrilleTv.tsx"),

  // Ma liste et Favoris passaient au travers : leur carte n'est ni la rangée ni
  // la grille de bibliothèque. Mesuré sur `/tv/favorites`, cinq focusables hors
  // rail — retour et filtres — et zéro carte, pour une carte affichée.
  [resolve(WEB, "components/collection/CollectionGridCard.tsx")]:
    resolve(CLIENT, "ui/cartes/CarteCollectionTv.tsx"),

  // Ma liste et Favoris : la sélection multiple et le partage quittent la
  // cible. Le premier sortait TOUTES les cartes du parcours du D-pad dès qu'on
  // y entrait ; le second ouvrait une modale qui confine le focus et n'offre
  // aucun bouton de fermeture — un piège sans issue à la télécommande. Les deux
  // pages du web ne sont que des compositions autour de `CollectionGrid`, et
  // c'est cette composition qu'on refait, moins ce qui n'a pas sa place.
  [resolve(WEB, "pages/Watchlist.tsx")]: resolve(CLIENT, "ui/collections/CollectionsTv.tsx"),
  [resolve(WEB, "pages/Favorites.tsx")]: resolve(CLIENT, "ui/collections/CollectionsTv.tsx"),

  // La liste d'épisodes était le seul endroit du catalogue où le D-pad ne
  // pouvait rien viser : la ligne du web est un `<div onClick>` sans `tabIndex`,
  // et le seul focusable qu'elle contenait était la pastille « marquer comme
  // vu » — vingt pixels de côté, sans libellé. On ne pouvait pas lancer un
  // épisode depuis la fiche d'une série.
  //
  // C'est la LISTE qui est substituée, pas la ligne : la nôtre importe
  // `EpisodeRow` du web et l'enveloppe, donc la vignette, la progression, les
  // pastilles de qualité et le synopsis restent les siens. Elle en profite pour
  // ne pas compiler la sélection multiple, « marquer la saison comme vue » et
  // les téléchargements, qui n'ont pas de sens à la télécommande.
  [resolve(WEB, "components/EpisodeList.tsx")]:
    resolve(CLIENT, "ui/episodes/ListeEpisodesTv.tsx"),

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

  // Deux des cinq sections de réglages ouvraient l'écran « Indisponible » :
  // leurs écrans ne sont pas compilés ici. Une section qui mène à une
  // explication d'absence n'est pas une section. La liste est ramenée à trois,
  // dont une nouvelle qui recueille ce que la barre du haut emportait avec elle
  // — « À propos », et la déconnexion.
  [resolve(WEB, "components/settings/SettingsLayout.tsx")]:
    resolve(CLIENT, "ui/reglages/ReglagesTv.tsx"),

  // L'apparence, figée en sombre. Ce module est le point de passage unique du
  // schéma de couleurs — `useThemeMode`, `ThemeProvider` et la section
  // Apparence en dépendent tous. Un téléviseur n'a pas de réglage système
  // clair/sombre à suivre : `prefers-color-scheme` n'y est pas renseigné, et le
  // mode clair n'a aucun emploi dans une pièce dont on a baissé la lumière.
  [resolve(WEB, "theme/colorScheme.ts")]: resolve(CLIENT, "shims/themeSombre.ts"),

  // `LibraryGrid` pose ses colonnes en style EN LIGNE, invisible aux passes
  // PostCSS comme à la garde de compatibilité : le build passe, et la grille
  // s'effondre sur la dalle. Ce hook est le seul endroit d'où la largeur est
  // déjà connue — il la publie, la feuille `grille-tv.css` fait le reste, et le
  // composant de 258 lignes n'est pas forké pour une déclaration.
  [resolve(WEB, "hooks/useItemsPerRow.ts")]: resolve(CLIENT, "ui/grille/colonnesTv.ts"),

  // Le survol, côté JavaScript. `passeSurvol` retire les règles `:hover` de la
  // feuille ; ces trois hooks portent ce que le CSS ne peut pas atteindre — les
  // gestionnaires `onMouseEnter` qui font basculer `data-hovered`, le panneau
  // d'aperçu, et un écouteur `pointermove` global posé À L'IMPORT du module.
  // Sur un téléviseur, le focus est la seule sélection ; le clic de la Magic
  // Remote, lui, reste actif (`focus/curseur.ts`).
  [resolve(WEB, "components/cards/useHoverPreview.ts")]: resolve(CLIENT, "shims/survolInerte.ts"),
  [resolve(WEB, "hooks/useHoverGuard.ts")]: resolve(CLIENT, "shims/survolInerte.ts"),
  [resolve(WEB, "hooks/useHoverMount.ts")]: resolve(CLIENT, "shims/survolInerte.ts"),

  // Les deux calques d'élévation de `.media-tile` sont pilotés par l'ATTRIBUT
  // `data-hovered`, hors de portée de toute passe CSS, et le lift est un
  // `transform` en style en ligne. Le cadre étant le point de passage unique de
  // toutes les cartes — affiches, vignettes, bibliothèque, collections — une
  // seule substitution les couvre.
  [resolve(WEB, "components/cards/CardFrame.tsx")]: resolve(CLIENT, "ui/cartes/CadreCarteTv.tsx"),

  // La barre de filtres devient une ZONE : y remonter depuis la grille vise le
  // filtre ACTIF, et non la pastille que l'abscisse de la carte désignait.
  [resolve(WEB, "components/LibraryFilters.tsx")]:
    resolve(CLIENT, "ui/bibliotheque/FiltresBibliothequeTv.tsx"),

  // Les menus de filtres d'une bibliothèque : le rôle qui piège passe sur le
  // panneau — années et note n'en avaient aucun, et le D-pad s'en échappait en
  // les laissant déployés —, la largeur devient celle d'un salon, et l'on
  // entre par l'option en cours.
  [resolve(WEB, "components/library/FilterMenu.tsx")]:
    resolve(CLIENT, "ui/bibliotheque/MenuFiltreTv.tsx"),

  // Le bloc d'actions de la fiche devient une ZONE du moteur de focus :
  // descendre depuis « Retour » ou les infos techniques atterrit sur
  // « Lecture »/« Reprendre », plus sur le trailer que l'ordonnée désignait.
  // L'enveloppe rend l'original tel quel.
  [resolve(WEB, "components/detail/DetailActions.tsx")]:
    resolve(CLIENT, "ui/fiche/ActionsFicheTv.tsx"),

  // La rangée des extras : son conteneur de défilement gagne `data-tv-piste`
  // — confinement horizontal, défilement suivi — et perd le `tabIndex` qui en
  // faisait une grande cible sans anneau.
  [resolve(WEB, "components/detail/ExtrasRow.tsx")]:
    resolve(CLIENT, "ui/fiche/RangeeExtrasTv.tsx"),

  // Le calque d'ouverture de la fiche est une chorégraphie écrite POUR
  // framer-motion : le shim en écarte `initial`, `animate` et `transition`, et
  // ce qui restait n'était pas une version dégradée mais une avarie — visuel en
  // vol sans dimensions, copie du décor figée à `blur(12px)` faute de
  // l'animation qui devait l'effacer, et une seconde de plein écran avant une
  // disparition sèche. Ce qui le remplace existe déjà : `tv.css` anime
  // `#root > *` en opacité sur 180 ms.
  [resolve(WEB, "components/detail/DetailOpenOverlay.tsx")]:
    resolve(CLIENT, "ui/fiche/CalqueOuvertureTv.tsx"),

  // Le profil d'appareil du téléviseur se compose des mêmes briques que celui
  // du navigateur, mais interroge `deviceInfo` en plus des sondes de codecs.
  // `construireProfil` de `usePlaybackInfo` n'est pas touché.
  [resolve(WEB, "lib/deviceProfile/browser.ts")]: resolve(CLIENT, "lecture/profilWebos.ts"),

  // Le HLS est toujours confié au moteur : la puce de la dalle décode le
  // manifeste, là où le client web a besoin de hls.js.
  [resolve(WEB, "hooks/useNativeHlsPreference.ts")]:
    resolve(CLIENT, "lecture/preferenceHlsNatif.ts"),

  // La barre de contrôle du web est une rangée de cibles de 44 px, un curseur
  // de volume révélé au survol, du plein écran et de l'incrustation d'image :
  // aucune de ces décisions ne survit à trois mètres. Ce qu'on remplace est du
  // dessin — le seek reste celui de `useSmartSeek`, câblé par les propriétés.
  [resolve(WEB, "components/PlayerControls.tsx")]: resolve(CLIENT, "lecture/ControlesTv.tsx"),

  // Le badge de saut, cumulatif. Le dessin du web est repris tel quel — c'est
  // le comptage qui change : on n'appuie pas une fois sur « +30 » à trois
  // mètres, on appuie trois fois, et trois fois « +30 s » laisse l'addition à
  // l'utilisateur.
  [resolve(WEB, "components/SkipBadge.tsx")]: resolve(CLIENT, "lecture/BadgeSautTv.tsx"),

  // Les boutons « passer l'intro / le générique » sont ancrés à vingt-quatre
  // pixels du bord — dans l'overscan — et paraissent quand l'habillage est
  // éteint, donc quand le moteur de focus s'est retiré de la route. Tout le
  // reste des surcouches convient tel quel.
  [resolve(WEB, "components/player/VideoPlayerOverlays.tsx")]: resolve(
    CLIENT,
    "lecture/SurcouchesTv.tsx",
  ),

  // Seule prise sur l'enveloppe qui masque les commandes. Le hook du web n'est
  // réarmé que par un mouvement de souris — une télécommande n'en produit pas,
  // et l'habillage s'éteindrait au bout de trois secondes sans jamais revenir.
  [resolve(WEB, "hooks/useControlsAutoHide.ts")]: resolve(CLIENT, "lecture/masquageAutoTv.ts"),

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

  // Le bouton de téléchargement de la fiche s'efface déjà sans le droit
  // Jellyfin, mais son import tirait tout l'arbre des téléchargements dans le
  // graphe de la fiche média.
  [resolve(WEB, "downloads/DetailDownloadAction.tsx")]: resolve(CLIENT, "shims/inerte.ts"),

  // Outils de développement montés à la racine par `App.tsx`.
  [resolve(WEB, "dev/soakPlayer.tsx")]: resolve(CLIENT, "shims/harnaisDev.ts"),
  [resolve(WEB, "dev/autoWatch.tsx")]: resolve(CLIENT, "shims/harnaisDev.ts"),
  [resolve(WEB, "dev/FrameMeter.tsx")]: resolve(CLIENT, "shims/frameMeter.ts"),
};
