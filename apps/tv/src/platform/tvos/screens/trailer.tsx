import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  applyPlayerRemoteSteps,
  TRAILER_CLOSE_KEY,
  TRAILER_PANEL_PREFIX,
  TRAILER_QUALITY_KEY,
  TRAILER_SUBTITLES_KEY,
  TRAILER_TIMELINE_KEY,
  trailerFocusable,
  trailerFocusClaim,
  trailerLeavesAfter,
  trailerNeighbor,
  trailerPanelCloseKey,
  trailerPanelReturnKey,
  trailerRemoteSteps,
  type Direction,
  type PlayerRemoteHandlers,
  type TrailerFocusView,
  type TrailerPanel,
  type TrailerState,
} from "@tentacle-tv/tv-core";
import { FocusBindingProvider } from "../../../redesign/focus/focusBinding";
import { REMOTE_BINDINGS, useRemoteIntents } from "../../input";
import { TrapFocusGuide } from "../focus/focusGuides";
import { setFocusLocked } from "../focus/focusLocks";
import { useFocusStore, type FocusStore } from "../focus/focusStore";
import { createSheetBackGroup, PlayerFocusStateProvider } from "../player/playerFocusContainers";

/**
 * L'applicateur de la BANDE-ANNONCE (lecteur simplifié), Apple TV et Android
 * TV — les décisions sont celles de tv-core (`player/trailerFocus.ts`,
 * `trailerControls.ts`, `trailerChrome.ts`) ; ce module ne fait que les
 * poser :
 * - ce qui se focalise (`trailerFocusable`) : le verrou de la plateforme
 *   (`isTVSelectable` sur tvOS, `tvFocusable` sur Android) ;
 * - les voisins (`trailerNeighbor`) : `nextFocus*` du nœud focalisé, « rester »
 *   pointant sur lui-même — ←/→ sur la barre appartiennent à la vidéo ;
 * - les réclamations : l'entrée, une cible devenue infocalisable, l'option
 *   retenue d'un panneau, le bouton qui l'a ouvert quand il s'est effacé ;
 * - les panneaux : la feuille retient le focus, sa marge mène à sa croix ;
 * - la télécommande : l'entrée unique, par la table des contrôles ;
 * - « indisponible » : le retour à la fiche.
 */

const TARGETS = [TRAILER_CLOSE_KEY, TRAILER_SUBTITLES_KEY, TRAILER_QUALITY_KEY, TRAILER_TIMELINE_KEY] as const;
const TOOLS: readonly string[] = [TRAILER_SUBTITLES_KEY, TRAILER_QUALITY_KEY];
const NEIGHBOR_PROPS: ReadonlyArray<readonly [Direction, string]> = [
  ["haut", "nextFocusUp"],
  ["bas", "nextFocusDown"],
  ["gauche", "nextFocusLeft"],
  ["droite", "nextFocusRight"],
];
const PANELS: readonly TrailerPanel[] = ["subtitles", "quality"];
// Les marges des feuilles, une par panneau, créées une fois (le port veut un conteneur stable).
const SHEET_BACK = {
  subtitles: createSheetBackGroup(trailerPanelCloseKey("subtitles")),
  quality: createSheetBackGroup(trailerPanelCloseKey("quality")),
} as const;

type Settable = { setNativeProps?: (props: object) => void };

/** Le magasin de focus de l'écran, ses panneaux liés avant le premier rendu. */
export function useTrailerFocusStore(): FocusStore {
  const store = useFocusStore();
  useState(() => {
    for (const panel of PANELS) {
      const prefix = TRAILER_PANEL_PREFIX[panel];
      store.bind(`${prefix}:panel`, { container: TrapFocusGuide });
      store.bind(`${prefix}:back`, { container: SHEET_BACK[panel] });
    }
  });
  return store;
}

const NO_ISLAND = { islandTrap: false, islandExit: false, activeSeasonIndex: 0 };

/** Le port du focus de l'écran, et l'état que lisent les marges des feuilles. */
export function TrailerFocusScope({ store, children }: { store: FocusStore; children: ReactNode }) {
  const [state] = useState(() => ({ store, ...NO_ISLAND }));
  return (
    <PlayerFocusStateProvider value={state}>
      <FocusBindingProvider bind={store.binder}>{children}</FocusBindingProvider>
    </PlayerFocusStateProvider>
  );
}

/**
 * Le focus de l'écran : verrous, voisins, réclamations. `panelEntry` :
 * l'option qui prend le focus à l'ouverture d'un panneau. Rend
 * `onPanelExited`, à donner à la vue : le panneau refermé a fini de
 * s'effacer, le focus revient à son bouton.
 */
export function useTrailerFocus(store: FocusStore, view: TrailerFocusView, panelEntry: string | null): { onPanelExited: () => void } {
  const viewRef = useRef(view);
  viewRef.current = view;
  const lastTool = useRef<string | null>(null);
  // Un panneau refermé garde le focus le temps de s'effacer : rien ne se réclame avant.
  const closing = useRef<TrailerPanel | null>(null);
  const openPanel = useRef<TrailerPanel | null>(view.panel);
  if (view.panel !== openPanel.current) {
    if (view.panel === null && openPanel.current !== null) closing.current = openPanel.current;
    openPanel.current = view.panel;
  }

  const aim = useCallback((key: string) => {
    const node = store.node(key) as Settable | null;
    if (!node || !(TARGETS as readonly string[]).includes(key)) return;
    const props: Record<string, number | null> = {};
    for (const [direction, prop] of NEIGHBOR_PROPS) {
      const target = trailerNeighbor(key, direction, viewRef.current, lastTool.current);
      props[prop] = store.handle(target === "stay" ? key : target);
    }
    node.setNativeProps?.(props);
  }, [store]);

  useEffect(() => store.subscribe((key, focused) => {
    if (!focused) return;
    if (TOOLS.includes(key)) lastTool.current = key;
    aim(key);
  }), [store, aim]);

  const { state, chromeShown, panel } = view;
  const { subtitles, quality } = view.tools;
  useEffect(() => {
    const current = viewRef.current;
    for (const key of TARGETS) setFocusLocked(store, key, !trailerFocusable(key, current));
    const focused = store.focusedKey();
    if (focused) aim(focused);
    if (closing.current !== null) return undefined;
    const claim = trailerFocusClaim(current, focused);
    return claim ? store.claim(claim) : undefined;
  }, [store, aim, state, chromeShown, panel, subtitles, quality]);

  useEffect(() => (panelEntry ? store.claim(panelEntry) : undefined), [store, panelEntry]);

  const onPanelExited = useCallback(() => {
    const closed = closing.current;
    closing.current = null;
    if (closed === null) return;
    const current = viewRef.current;
    const back = trailerPanelReturnKey(closed, current.chromeShown);
    const key = back !== null && trailerFocusable(back, current) ? back : trailerFocusClaim(current, store.focusedKey());
    if (key) store.claim(key);
  }, [store]);

  return { onPanelExited };
}

/**
 * La télécommande de l'écran, par l'entrée unique : les intentions passent
 * par la table de la bande-annonce (`trailerRemoteSteps`, qui laisse OK sur la
 * barre à son appui) jusqu'aux contrôles. Retour n'y entre pas : la pile du
 * Retour le sert.
 */
export function useTrailerRemote(remote: PlayerRemoteHandlers, store: FocusStore, enabled: boolean): void {
  useRemoteIntents(
    (event) => applyPlayerRemoteSteps(
      trailerRemoteSteps(event.intent, REMOTE_BINDINGS.traits, event.signal.phase, store.focusedKey()),
      remote,
    ),
    enabled,
  );
}

/** « Indisponible » : la fiche revient d'elle-même, le temps de lire la phrase. */
export function useTrailerReturn(state: TrailerState, screenFocused: boolean, close: () => void): void {
  useEffect(() => {
    const delay = trailerLeavesAfter(state, screenFocused);
    if (delay === null) return undefined;
    const timer = setTimeout(close, delay);
    return () => clearTimeout(timer);
  }, [state, screenFocused, close]);
}
