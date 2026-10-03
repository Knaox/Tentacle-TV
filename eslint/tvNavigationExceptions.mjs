/**
 * Les exceptions EXPLICITES de la garde de la navigation TV (`tvNavigation.mjs`).
 *
 * Une entrée : un fichier (relatif à `apps/tv/src/`), les familles de règles
 * qu'il peut encore employer, la tâche qui le traite et pourquoi il est là.
 * La justification est obligatoire : elle dit ce qui reste à extraire, ou
 * pourquoi l'usage n'est pas de la navigation.
 *
 * La liste FOND : une tâche qui extrait un fichier retire sa ligne dans la
 * même fusion — `node eslint/tvNavigationAudit.mjs` signale toute exception
 * périmée et tout usage nouveau. Le détail, ligne par ligne :
 * docs/tv-navigation/inventaire.md.
 *
 * `owner` : T1 socle, T3 focus et rangées, T4 Retour et rail, T5 lecteur,
 * T6 panneaux et cartes, T7 écrans ; `null` : hors navigation, exception
 * PERMANENTE (rendu, libellé, aiguillage de la refonte).
 */
export const TV_NAV_EXCEPTIONS = [
  // T1 — le socle : l'abonnement natif à la télécommande et sa traduction.
  { file: "redesignWiring/remote/remoteEvents.ts", rules: ["no-remote-events", "no-platform-branch"], owner: "T1", why: "abonnement natif unique (TVEventHandler) et traduction tvOS des événements → tv-core remote/ + adaptateur" },
  { file: "redesignWiring/redesignGate.ts", rules: ["no-platform-branch"], owner: null, why: "l'aiguillage de la refonte : le seul choix de plateforme du chemin refondu" },

  // T3 — focus, sections, rangées.
  { file: "redesign/focus/FocusTarget.tsx", rules: ["no-native-press"], owner: "T3", why: "la porte des vues vers le focus natif : le seul Pressable de la refonte (OK, appui long, focus)" },
  { file: "redesign/focus/FocusSection.tsx", rules: ["no-native-focus-calls"], owner: "T3", why: "la porte des vues vers la section native (TentacleFocusSection)" },
  { file: "redesign/focus/nativeFocusSection.ts", rules: ["no-native-focus-calls", "no-platform-branch"], owner: "T3", why: "détection et requireNativeComponent de la section native" },
  { file: "redesignWiring/focus/focusStore.ts", rules: ["no-native-focus-calls"], owner: "T3", why: "magasin de focus : nœuds natifs, findNodeHandle, requestTVFocus, réclamation" },
  { file: "redesignWiring/focus/entryGuide.tsx", rules: ["no-focus-guides", "no-focus-props"], owner: "T3", why: "guide d'entrée d'un groupe : dernier visité, sinon l'entrée par défaut" },
  { file: "redesignWiring/focus/focusGuides.tsx", rules: ["no-focus-guides"], owner: "T3", why: "guides génériques : mémoire (autoFocus), piège (trapFocus*)" },
  { file: "redesignWiring/focus/focusLocks.ts", rules: ["no-focus-props", "no-native-focus-calls"], owner: "T3", why: "verrou d'une cible (isTVSelectable), par la liaison et par setNativeProps" },
  { file: "redesignWiring/focus/sectionEntry.ts", rules: ["no-focus-props", "no-native-focus-calls"], owner: "T3", why: "entrée déclarée d'une section (tvEntry)" },
  { file: "redesignWiring/focus/sectionNeighbors.ts", rules: ["no-focus-props"], owner: "T3", why: "règle de voisinage des sections, appliquée en natif (tvNeighbors)" },
  { file: "redesignWiring/screen/useEntryFocus.ts", rules: ["no-focus-props"], owner: "T3", why: "entrée d'un écran : hasTVPreferredFocus pendant l'arrivée" },
  { file: "redesignWiring/remote/parallax.ts", rules: ["no-focus-props", "no-platform-branch"], owner: "T3", why: "parallaxe au pouce par forme (tvParallaxProperties), coupée au mouvement réduit — T6 si elle suit les cartes" },

  // T4 — Retour, rail, menus.
  { file: "redesignWiring/back/BackScope.tsx", rules: ["no-native-focus-calls"], owner: "T4", why: "la portée du Retour monte MenuPressInterceptor" },
  { file: "components/focus/MenuPressInterceptor.ios.tsx", rules: ["no-native-focus-calls"], owner: "T4", why: "la vue native qui prend Menu (TVMenuPressInterceptor)" },
  { file: "redesignWiring/focus/backFocus.tsx", rules: ["no-focus-guides", "no-focus-props", "no-native-focus-calls"], owner: "T4", why: "croix Retour : guide de sa bande, BAS vers le dernier contenu (nextFocusDown), verrou — T3 pour le guide" },
  { file: "redesignWiring/screen/RailBridges.tsx", rules: ["no-focus-guides", "no-platform-branch"], owner: "T4", why: "ponts navigation ↔ contenu (guides natifs)" },
  { file: "redesignWiring/screen/RailShortcuts.tsx", rules: ["no-focus-guides", "no-platform-branch"], owner: "T4", why: "raccourcis du rail vers le profil, armés après un temps (guides natifs)" },

  // T5 — le lecteur.
  { file: "redesignWiring/player/PlayerRedesignStage.tsx", rules: ["no-native-press", "no-focus-props"], owner: "T5", why: "fond focalisable du lecteur (TouchableOpacity, préférence, focusable)" },
  { file: "redesignWiring/player/playerFocusContainers.tsx", rules: ["no-focus-guides", "no-focus-props"], owner: "T5", why: "guides et pièges de l'habillage, des îlots et des panneaux" },
  { file: "redesignWiring/player/usePlayerFocus.ts", rules: ["no-focus-props"], owner: "T5", why: "préférence de focus des commandes de l'habillage" },
  { file: "redesignWiring/player/endExitLock.ts", rules: ["no-focus-props"], owner: "T5", why: "verrou de sortie de l'écran de fin (isTVSelectable)" },
  { file: "redesignWiring/player/usePlaybackTrouble.ts", rules: ["no-remote-events"], owner: "T5", why: "écoute native directe (useTVEventHandler) du panneau des pannes" },
  { file: "components/player/focus/useOverlayFocus.ios.ts", rules: ["no-focus-props", "no-native-focus-calls"], owner: "T5", why: "focus de l'habillage : bascule de hasTVPreferredFocus (RN-tvos #849)" },
  { file: "hooks/useScrubGestures.ios.ts", rules: ["no-remote-events"], owner: "T5", why: "glisser du pavé (pan) pour parcourir la vidéo — écoute native directe" },
  { file: "lib/tvPanGesture.ts", rules: ["no-remote-events", "no-platform-branch"], owner: "T5", why: "TVEventControl.enableTVPanGesture, compté par détenteur" },
  { file: "components/player/AVPlayerSurface.tsx", rules: ["no-focus-props"], owner: "T5", why: "surface vidéo jamais focalisable (focusable={false})" },

  // T7 — les écrans.
  { file: "redesignWiring/detail/useDetailGuides.ts", rules: ["no-focus-guides"], owner: "T7", why: "pièges latéraux des rangées de la fiche (trapFocusLeft/Right)" },
  { file: "redesignWiring/search/useSystemKeyboard.ts", rules: ["no-native-press", "no-native-focus-calls"], owner: "T7", why: "champ de recherche : clavier système (.focus()) et ses props natives" },
  { file: "redesignWiring/settings/settingsFocus.tsx", rules: ["no-focus-guides"], owner: "T7", why: "guide des onglets des réglages (destinations)" },
  { file: "redesignWiring/trailer/TrailerRedesign.tsx", rules: ["no-focus-props"], owner: "T7", why: "entrée de la bande-annonce (hasTVPreferredFocus)" },
  { file: "redesign/screens/pairing/PairingField.tsx", rules: ["no-native-press"], owner: "T7", why: "une VUE qui ouvre le clavier système (.focus() / .blur() d'un TextInput)" },
  { file: "screens/trailer/TrailerWebView.ios.tsx", rules: ["no-focus-props"], owner: "T7", why: "la WebView de la bande-annonce n'est jamais focalisable" },

  // Hors navigation — exceptions permanentes.
  { file: "redesign/motion/motion.ts", rules: ["no-platform-branch"], owner: null, why: "rendu : le mouvement n'est joué que sur Apple TV" },
  { file: "redesign/glass/nativeGlass.ts", rules: ["no-platform-branch"], owner: null, why: "rendu : détection du verre natif de tvOS 26" },
  { file: "redesign/cards/nativeDesaturate.ts", rules: ["no-platform-branch"], owner: null, why: "rendu : détection de la vue native de désaturation" },
  { file: "redesignWiring/vigie/useVigieGate.ts", rules: ["no-platform-branch"], owner: null, why: "libellé : la plateforme déclarée à Vigie (appletv / androidtv)" },
  { file: "redesignWiring/settings/useSettingsModel.ts", rules: ["no-platform-branch"], owner: null, why: "réglages d'appareil d'Android TV : branche morte (la refonte ne tourne que sur tvOS)" },
];
