import { TV_NAV_EXCEPTIONS } from "./tvNavigationExceptions.mjs";

/**
 * La garde de la navigation TV — une seule source.
 *
 * L'Apple TV refondue est la référence de la navigation : ses INTENTIONS, la
 * TRADUCTION de la télécommande par plateforme et ses COMPORTEMENTS vivent dans
 * `@tentacle-tv/tv-core` ; l'adaptateur tvOS (`apps/tv/src/platform/tvos/`) ne
 * fait qu'APPLIQUER ce qu'ils décident (docs/TV-NAVIGATION.md). Ces règles
 * refusent les API natives de télécommande et de focus partout ailleurs dans le
 * chemin refondu : un geste ou une décision de focus qui s'y écrirait
 * échapperait à Android TV le jour où il se branchera.
 *
 * Six familles, une règle chacune — chaque exception vise UNE famille d'un
 * fichier, jamais le fichier entier (`tvNavigationExceptions.mjs`).
 *
 * Portée : la refonte (`redesign/`, `redesignWiring/`) et ce qui ne tourne que
 * sur tvOS (`*.ios.ts(x)`). L'ancienne UI et le code d'Android TV ne sont pas
 * concernés ; les hooks partagés avec Android TV non plus (l'inventaire les
 * suit : docs/tv-navigation/inventaire.md). Les minuteries de navigation ne se
 * lisent pas au lint : l'inventaire les suit aussi.
 *
 * Les sélecteurs sont ceux d'esquery, comme `no-restricted-syntax` : pas
 * d'analyse typée, donc un NOM. Un faux positif s'écarte par une exception
 * justifiée, jamais par un `eslint-disable`.
 */

const RN = "ImportDeclaration[source.value='react-native'] > ImportSpecifier";
const ADAPTER = "l'adaptateur tvOS (apps/tv/src/platform/tvos/)";

const FAMILIES = {
  "no-remote-events": {
    message: `Navigation TV : la télécommande s'écoute dans ${ADAPTER} et arrive en INTENTIONS (tv-core) — docs/TV-NAVIGATION.md.`,
    selectors: [
      `${RN}[imported.name=/^(TVEventHandler|useTVEventHandler|TVEventControl|BackHandler)$/]`,
      // `const { useTVEventHandler } = require("react-native")`, le motif de l'ancienne UI.
      "ObjectPattern > Property[key.name=/^(TVEventHandler|useTVEventHandler|TVEventControl|BackHandler)$/]",
    ],
  },
  "no-focus-guides": {
    message: `Navigation TV : un guide de focus natif se pose dans ${ADAPTER} ; où va le focus se décide dans tv-core.`,
    selectors: [
      `${RN}[imported.name=/^(TVFocusGuideView|TVTextScrollView)$/]`,
      "JSXAttribute[name.name=/^(destinations|autoFocus|trapFocus(Up|Down|Left|Right))$/]",
      "ObjectExpression > Property[key.name=/^(destinations|autoFocus|trapFocus(Up|Down|Left|Right))$/]",
    ],
  },
  "no-focus-props": {
    message: `Navigation TV : une prop native de focus (préférence, destination, sélectionnable, parallaxe, section) se pose dans ${ADAPTER}, sur une décision de tv-core.`,
    selectors: [
      "JSXAttribute[name.name=/^(hasTVPreferredFocus|nextFocus(Up|Down|Left|Right|Forward)|isTVSelectable|tvParallaxProperties|focusable|tvEntry|tvNeighbors)$/]",
      "ObjectExpression > Property[key.name=/^(hasTVPreferredFocus|nextFocus(Up|Down|Left|Right|Forward)|isTVSelectable|tvParallaxProperties|focusable|tvEntry|tvNeighbors)$/]",
    ],
  },
  "no-native-focus-calls": {
    message: `Navigation TV : les commandes natives du focus (setNativeProps, requestTVFocus, findNodeHandle, vues natives du focus et du Menu) vivent dans ${ADAPTER}.`,
    selectors: [
      "MemberExpression[property.name=/^(setNativeProps|requestTVFocus)$/]",
      `${RN}[imported.name='findNodeHandle']`,
      "Literal[value=/^(TentacleFocusSection|TVMenuPressInterceptor)$/]",
      "ImportSpecifier[imported.name=/^(MenuPressInterceptor|NativeFocusSection)$/]",
    ],
  },
  "no-native-press": {
    message: `Navigation TV : un focalisable natif ne se rend que par FocusTarget (le port du focus) ; OK, appui long et focus d'un élément natif passent par ${ADAPTER}.`,
    selectors: [
      "JSXOpeningElement[name.name=/^(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)$/]",
      "JSXOpeningElement[name.name=/^(View|TextInput|ScrollView)$/] > JSXAttribute[name.name=/^(onFocus|onBlur)$/]",
      // Le focus d'un champ (le clavier système de tvOS) : `.focus()` / `.blur()`.
      "CallExpression[arguments.length=0] > MemberExpression.callee[property.name=/^(focus|blur)$/]",
    ],
  },
  "no-platform-branch": {
    message: "Navigation TV : pas d'aiguillage de plateforme dans le chemin refondu — l'adaptateur de la plateforme décide (redesignGate.ts pour l'aiguillage de la refonte).",
    selectors: ["MemberExpression[object.name='Platform'][property.name=/^(OS|isTV|isTVOS|select)$/]"],
  },
};

export const TV_NAV_RULES = Object.keys(FAMILIES);

function selectorRule({ message, selectors }) {
  return {
    meta: { type: "problem", docs: { description: message }, schema: [] },
    create(context) {
      const report = (node) => context.report({ node, message });
      return Object.fromEntries(selectors.map((selector) => [selector, report]));
    },
  };
}

export const tvNavigationPlugin = {
  meta: { name: "tv-nav" },
  rules: Object.fromEntries(Object.entries(FAMILIES).map(([name, family]) => [name, selectorRule(family)])),
};

const SRC = "apps/tv/src/";

/**
 * Le chemin refondu : la refonte, et ce qui ne tourne que sur tvOS — les
 * fichiers `.ios`, et ceux qui n'ont que du code tvOS pour importateurs, sans
 * le suffixe (relevé de l'inventaire : seul celui-ci porte encore une API
 * native de focus ; `lib/tvPanGesture.ts` est parti avec le code de transition).
 */
export const TV_NAV_SCOPE = [
  `${SRC}redesign/**/*.{ts,tsx}`,
  `${SRC}redesignWiring/**/*.{ts,tsx}`,
  `${SRC}**/*.ios.{ts,tsx}`,
  `${SRC}components/player/AVPlayerSurface.tsx`,
];

/** Là où ces API ont leur place, et les tests (qui simulent l'adaptateur). */
export const TV_NAV_ALLOWED = [`${SRC}platform/tvos/**`, "**/*.test.{ts,tsx}"];

/** Les fichiers encore exemptés d'une famille, relatifs à la racine du dépôt. */
export function exceptionsOf(rule) {
  return TV_NAV_EXCEPTIONS.filter((entry) => entry.rules.includes(rule)).map((entry) => `${SRC}${entry.file}`);
}

/** Les blocs de configuration, une famille par bloc : `severity` vaut pour toutes. */
export function tvNavigationConfigs(severity) {
  return TV_NAV_RULES.map((rule) => ({
    files: TV_NAV_SCOPE,
    ignores: [...TV_NAV_ALLOWED, ...exceptionsOf(rule)],
    plugins: { "tv-nav": tvNavigationPlugin },
    rules: { [`tv-nav/${rule}`]: severity },
  }));
}
