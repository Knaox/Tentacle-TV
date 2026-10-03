/**
 * Le FOCUS du lecteur (Apple TV refondu), en règles pures : qui le prend à
 * l'apparition, quelle préférence porte chaque entrée, quelles croix restent
 * verrouillées, où mènent les ponts, à qui un panneau refermé le rend. Les
 * applicateurs natifs (guides `TVFocusGuideView`, `hasTVPreferredFocus`,
 * `isTVSelectable`, réclamations) sont dans `apps/tv/src/platform/tvos/player`.
 */

/** Les boutons de l'habillage, et leur clé dans la mémoire du dernier bouton
 *  (`overlayFocusCore`) : `settings` est le bouton des PISTES (le nom
 *  d'Android TV), `options` l'onglet « Réglages ». */
export const PLAYER_OSD_KEYS = {
  "player:back": "back",
  "player:prev": "prev",
  "player:seekback": "skipback",
  "player:playpause": "playpause",
  "player:seekforward": "skipforward",
  "player:scrub": "scrub",
  "player:next": "next",
  "player:episodes": "episodes",
  "player:tracks": "settings",
  "player:settings": "options",
} as const;

export type PlayerOsdKey = keyof typeof PLAYER_OSD_KEYS;
export type PlayerTransportKey = (typeof PLAYER_OSD_KEYS)[PlayerOsdKey];

/** Ce que la pilule de saut regarde de la surimpression de l'arbitre. */
export interface SkipOverlayState {
  kind: string;
  auto?: boolean;
  dismissible?: boolean;
}

/**
 * La pilule de saut et le focus. Refusable : un passage AUTOMATIQUE pas encore
 * en sourdine (« Masquer » est à l'écran). Elle PREND le focus si elle est à
 * l'écran, pas encore en sourdine, et qu'aucune feuille n'est ouverte — ce
 * qui revient par l'habillage a déjà été refusé : il se montre, il ne s'impose
 * pas.
 */
export function skipPillFocus(s: { overlay: SkipOverlayState; pillShown: boolean; showSettings: boolean }): {
  refusable: boolean;
  grabs: boolean;
} {
  const refusable = s.overlay.kind === "skip" && s.overlay.auto === true && s.overlay.dismissible === true;
  const dismissible = (s.overlay.kind === "skip" || s.overlay.kind === "nextButton") && s.overlay.dismissible === true;
  return { refusable, grabs: s.pillShown && dismissible && !s.showSettings };
}

/**
 * La préférence d'origine de chaque entrée (`hasTVPreferredFocus`) ;
 * `undefined` : aucune. La pilule préfère le geste UTILE — « Masquer » quand
 * le passage part tout seul, « Passer » quand il faut le demander.
 */
export function preferredFocusOf(
  key: string,
  s: { grabs: boolean; refusable: boolean; failed: boolean; sheetEntryKey: string | null },
): boolean | undefined {
  switch (key) {
    case "player:skip": return s.grabs && !s.refusable;
    case "player:skip-dismiss": return s.grabs;
    case "loading:back": return !s.failed;
    case "loading:retry": return s.failed;
    case "upnext:play":
    case "end:play": return true;
    default: return key === s.sheetEntryKey ? true : undefined;
  }
}

/**
 * Les entrées RÉCLAMÉES à leur apparition (`hasTVPreferredFocus` seul n'est
 * honoré qu'au montage) : l'écran d'ouverture (la croix, sa seule action ;
 * « Réessayer » s'il a échoué), la carte « À suivre », l'affiche de fin, la
 * feuille (son option retenue).
 */
export function playerFocusClaims(s: {
  loading: boolean;
  failed: boolean;
  upNextShown: boolean;
  endShown: boolean;
  sheetEntryKey: string | null;
}): Array<{ key: string | null; active: boolean }> {
  return [
    { key: s.failed ? "loading:retry" : "loading:back", active: s.loading },
    { key: "upnext:play", active: s.upNextShown },
    { key: "end:play", active: s.endShown },
    { key: s.sheetEntryKey, active: s.sheetEntryKey !== null },
  ];
}

/**
 * La croix d'un écran du lecteur n'est jamais son entrée : tant que l'entrée
 * n'a pas eu le focus depuis l'apparition de l'écran, elle reste
 * infocalisable. Affiche de fin : « Lire maintenant » ; message-outil :
 * « Réessayer maintenant ».
 */
export const PLAYER_EXIT_LOCKS = [
  { exit: "end:leave", entry: "end:play" },
  { exit: "trouble:back", entry: "trouble:retry" },
] as const;

export function exitLocked(shown: boolean, entryVisited: boolean): boolean {
  return shown && !entryVisited;
}

/** Les écrans qui couvrent la vidéo retiennent le focus (piège) ; un focus qui
 *  y ARRIVE va à la première de leurs entrées montée — jamais par la croix. */
export const PLAYER_SCREEN_ENTRIES = {
  loading: ["loading:retry", "loading:back"],
  end: ["end:play"],
  trouble: ["trouble:retry"],
} as const;

/**
 * Le pont de la FRISE — rien d'aligné entre les commandes et ce qui est
 * au-dessus d'elles. Il a un SENS, lu sur le focus : depuis Retour, il
 * redescend vers lecture/pause ; sinon il monte vers la pilule de saut si
 * elle est publiée, vers Retour sinon.
 */
export function timelineBridgeTarget(focusedKey: string | null, skipPublished: boolean): "player:playpause" | "player:skip" | "player:back" {
  if (focusedKey === "player:back") return "player:playpause";
  return skipPublished ? "player:skip" : "player:back";
}

/** Le pont du message-outil : de la croix vers « Réessayer maintenant », et retour. */
export function troubleBridgeTarget(focusedKey: string | null): "trouble:retry" | "trouble:back" {
  return focusedKey === "trouble:back" ? "trouble:retry" : "trouble:back";
}

/**
 * L'îlot de la pilule : il RETIENT le focus à gauche et à droite pendant un
 * passage automatique, habillage caché ; habillage affiché et focus dans
 * l'îlot, ses SORTIES mènent à lecture/pause (bas) et à Retour (haut, gauche).
 */
export function skipIslandGuides(s: { refusable: boolean; overlayVisible: boolean; islandFocused: boolean }): {
  trap: boolean;
  exits: boolean;
} {
  return { trap: s.refusable && !s.overlayVisible, exits: s.overlayVisible && s.islandFocused };
}

/** Le bouton qui ouvre le panneau des épisodes ; la feuille, elle, dit sa pilule. */
export const EPISODES_OPENER = "player:episodes";

/** Le bouton à qui rendre le focus : celui du DERNIER panneau ouvert. */
export function panelOpener(s: { showSettings: boolean; showEpisodes: boolean; sheetOpener: string; previous: string | null }): string | null {
  if (s.showSettings) return s.sheetOpener;
  if (s.showEpisodes) return EPISODES_OPENER;
  return s.previous;
}

/** À la fin du fondu d'un panneau refermé : son bouton, si l'habillage est là
 *  (masqué entre-temps par un second Retour : le fond reprend le focus). */
export function panelReturnTarget(opener: string | null, overlayVisible: boolean): string | null {
  return opener && overlayVisible ? opener : null;
}

/** L'entrée de la feuille : l'option retenue de sa première colonne, sinon la
 *  première, sinon sa croix — figée tant que la feuille reste ouverte. */
export function sheetEntryKey(prefix: string, column: string, options: ReadonlyArray<{ key: string; selected?: boolean }>): string {
  const option = options.find((o) => o.selected) ?? options[0];
  return option ? `${prefix}:${column}:${option.key}` : `${prefix}:close`;
}

/** L'entrée du panneau des épisodes : l'épisode EN COURS s'il est dans la
 *  saison affichée, sinon la première ligne ; rien tant que la liste manque. */
export function episodesEntryKey(open: boolean, episodeIds: readonly string[] | undefined, currentId: string | undefined): string | null {
  if (!open || !episodeIds) return null;
  return `episodes:episode:${Math.max(0, episodeIds.indexOf(currentId ?? ""))}`;
}

/** Focus maintenu sur une saison avant de la précharger : balayer la bande ne charge rien. */
export const SEASON_PREFETCH_INTENT_MS = 200;

/**
 * Le cycle de la préférence de focus NATIVE sur tvOS (react-native-tvos
 * #849) : reposer `vrai` sur une préférence déjà vraie ne déplace rien — on la
 * repasse à faux, puis à vrai `armMs` plus tard, et on la RELÂCHE `releaseMs`
 * après : laissée vraie, elle retient le focus, et l'utilisateur ne peut plus
 * s'en éloigner durablement.
 */
export const FOCUS_PREFERENCE_CYCLE = { armMs: 50, releaseMs: 120 } as const;
