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
  // T1 — le socle : fait (756ed8bc7), l'entrée unique vit dans platform/tvos/input/.
  { file: "redesignWiring/redesignGate.ts", rules: ["no-platform-branch"], owner: null, why: "l'aiguillage de la refonte : le seul choix de plateforme du chemin refondu" },

  // T3 — fait (cbe686f9f). Restent, PERMANENTES, les portes des vues : une vue de redesign/ ne touche au focus natif que par elles.
  { file: "redesign/focus/FocusTarget.tsx", rules: ["no-native-press"], owner: null, why: "la porte des vues vers le focus natif : le seul Pressable de la refonte (OK, appui long, focus, flou) ; ce qu'on y pose vient du port" },
  { file: "redesign/focus/FocusSection.tsx", rules: ["no-native-focus-calls"], owner: null, why: "la porte des vues vers la section native (TentacleFocusSection) ; la règle de voisinage vient du port" },
  { file: "redesign/focus/nativeFocusSection.ts", rules: ["no-native-focus-calls", "no-platform-branch"], owner: null, why: "détection de la section native, lue par FocusSection seul" },

  // T4 — Retour, rail, menus.
  { file: "components/focus/MenuPressInterceptor.ios.tsx", rules: ["no-native-focus-calls"], owner: "T4", why: "la vue native qui prend Menu (TVMenuPressInterceptor)" },

  // T5 — le lecteur.

  // T7 — les écrans.
  { file: "redesignWiring/detail/useDetailGuides.ts", rules: ["no-focus-guides"], owner: "T7", why: "pièges latéraux des rangées de la fiche (trapFocusLeft/Right)" },
  { file: "redesignWiring/search/useSystemKeyboard.ts", rules: ["no-native-press", "no-native-focus-calls"], owner: "T7", why: "champ de recherche : clavier système (.focus()) et ses props natives" },
  { file: "redesignWiring/settings/settingsFocus.tsx", rules: ["no-focus-guides"], owner: "T7", why: "guide des onglets des réglages (destinations)" },
  { file: "redesignWiring/trailer/TrailerRedesign.tsx", rules: ["no-focus-props"], owner: "T7", why: "entrée de la bande-annonce (hasTVPreferredFocus)" },
  { file: "redesign/screens/pairing/PairingField.tsx", rules: ["no-native-press"], owner: "T7", why: "une VUE qui ouvre le clavier système (.focus() / .blur() d'un TextInput)" },

  // Hors navigation — exceptions permanentes.
  { file: "components/player/AVPlayerSurface.tsx", rules: ["no-focus-props"], owner: null, why: "rendu : surface de rendu, jamais focalisable ; inerte sur tvOS, gardé tel quel (arbitrage du lot)" },
  { file: "screens/trailer/TrailerWebView.ios.tsx", rules: ["no-focus-props"], owner: null, why: "rendu : surface de rendu, jamais focalisable ; inerte sur tvOS, gardé tel quel (arbitrage du lot)" },
  { file: "redesign/motion/motion.ts", rules: ["no-platform-branch"], owner: null, why: "rendu : le mouvement n'est joué que sur Apple TV" },
  { file: "redesign/glass/nativeGlass.ts", rules: ["no-platform-branch"], owner: null, why: "rendu : détection du verre natif de tvOS 26" },
  { file: "redesign/cards/nativeDesaturate.ts", rules: ["no-platform-branch"], owner: null, why: "rendu : détection de la vue native de désaturation" },
  { file: "redesignWiring/remote/parallax.ts", rules: ["no-focus-props", "no-platform-branch"], owner: null, why: "rendu : l'inclinaison au pouce par forme (tvParallaxProperties), coupée au mouvement réduit — docs/tv-navigation/remote.md" },
  { file: "redesignWiring/vigie/useVigieGate.ts", rules: ["no-platform-branch"], owner: null, why: "libellé : la plateforme déclarée à Vigie (appletv / androidtv)" },
  { file: "redesignWiring/settings/useSettingsModel.ts", rules: ["no-platform-branch"], owner: null, why: "réglages d'appareil d'Android TV : branche morte (la refonte ne tourne que sur tvOS)" },
];
