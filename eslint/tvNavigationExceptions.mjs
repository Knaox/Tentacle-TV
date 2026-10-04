/**
 * Les exceptions EXPLICITES de la garde de la navigation TV (`tvNavigation.mjs`).
 *
 * Une entrée : un fichier (relatif à `apps/tv/src/`), les familles de règles
 * qu'il peut employer, et pourquoi. La justification est obligatoire.
 *
 * L'extraction faite, il ne reste que des exceptions PERMANENTES (`owner:
 * null`) : les portes par lesquelles une vue touche au focus natif, la vue
 * native du Retour, l'aiguillage de la refonte, et ce qui n'est pas de la
 * navigation (rendu, libellé, réglage d'appareil). Un usage nouveau ne s'y
 * ajoute pas : il va dans l'adaptateur (`apps/tv/src/platform/tvos/`), sa
 * décision dans tv-core. Une exception nouvelle se justifie ici, au même titre
 * que celles-ci.
 *
 * `node eslint/tvNavigationAudit.mjs` signale toute exception devenue inutile.
 * Le détail : docs/tv-navigation/inventaire.md.
 */
export const TV_NAV_EXCEPTIONS = [
  // Les portes des vues : une vue de redesign/ ne touche au focus natif que par elles.
  { file: "redesign/focus/FocusTarget.tsx", rules: ["no-native-press"], owner: null, why: "la porte des vues vers le focus natif : le seul Pressable de la refonte (OK, appui long, focus, flou) ; ce qu'on y pose vient du port" },
  { file: "redesign/focus/FocusSection.tsx", rules: ["no-native-focus-calls"], owner: null, why: "la porte des vues vers la section native (TentacleFocusSection) ; la règle de voisinage vient du port" },
  { file: "redesign/focus/nativeFocusSection.ts", rules: ["no-native-focus-calls", "no-platform-branch"], owner: null, why: "détection de la section native, lue par FocusSection seul" },

  // La vue native du Retour, à côté de son jumeau d'Android TV (MenuPressInterceptor.tsx) ; seul platform/tvos/back/ l'importe.
  { file: "components/focus/MenuPressInterceptor.ios.tsx", rules: ["no-native-focus-calls"], owner: null, why: "la vue native qui prend Menu (TVMenuPressInterceptor) ; l'applicateur du Retour en décide l'état" },

  // L'aiguillage de la refonte.
  { file: "redesignWiring/redesignGate.ts", rules: ["no-platform-branch"], owner: null, why: "l'aiguillage de la refonte : le seul choix de plateforme du chemin refondu" },

  // Hors navigation.
  { file: "components/player/AVPlayerSurface.tsx", rules: ["no-focus-props"], owner: null, why: "rendu : surface de rendu, jamais focalisable ; inerte sur tvOS, gardé tel quel (arbitrage du lot)" },
  { file: "redesign/glass/nativeGlass.ts", rules: ["no-platform-branch"], owner: null, why: "rendu : détection du verre natif de tvOS 26" },
  { file: "redesignWiring/remote/parallax.ts", rules: ["no-focus-props", "no-platform-branch"], owner: null, why: "rendu : l'inclinaison au pouce par forme (tvParallaxProperties), coupée au mouvement réduit — docs/tv-navigation/remote.md" },
  { file: "redesignWiring/vigie/useVigieGate.ts", rules: ["no-platform-branch"], owner: null, why: "libellé : la plateforme déclarée à Vigie (appletv / androidtv)" },
  { file: "redesignWiring/settings/useSettingsModel.ts", rules: ["no-platform-branch"], owner: null, why: "réglages d'appareil d'Android TV, gardés pour le jour où la refonte y tournera" },
];
