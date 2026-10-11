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
  trailerPanelCloseKey,
  trailerPanelReturnKey,
  trailerRemoteSteps,
  trailerStartClaim,
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
import { TRAILER_BRIDGES, TrailerBridgeProvider, type TrailerBridgeScope } from "./trailerBridges";
import { applyTrailerNeighbors } from "./trailerNeighbors";

/**
 * L'applicateur de la BANDE-ANNONCE (lecteur simplifié), Apple TV et Android
 * TV — les décisions sont celles de tv-core (`player/trailerFocus.ts`,
 * `trailerControls.ts`, `trailerChrome.ts`) ; ce module ne fait que les
 * poser :
 * - ce qui se focalise (`trailerFocusable`) : le verrou de la plateforme
 *   (`isTVSelectable` sur tvOS, `tvFocusable` sur Android) ;
 * - les voisins (`trailerNeighbor`) : les PONTS armés selon le focus
 *   (`trailerBridges.tsx`, tvOS), `nextFocus*` sur Android
 *   (`trailerNeighbors.android.ts`) ;
 * - les réclamations : l'entrée (la croix au chargement, puis le premier
 *   bouton dès que la lecture commence), une cible devenue infocalisable, l'option
 *   retenue d'un panneau, le bouton qui l'a ouvert quand il s'est effacé ;
 * - les panneaux : la feuille retient le focus, sa marge mène à sa croix ;
 * - la télécommande : l'entrée unique, par la table des contrôles ;
 * - « indisponible » : le retour à la fiche.
 */

const TARGETS = [TRAILER_CLOSE_KEY, TRAILER_SUBTITLES_KEY, TRAILER_QUALITY_KEY, TRAILER_TIMELINE_KEY] as const;
const TOOLS: readonly string[] = [TRAILER_SUBTITLES_KEY, TRAILER_QUALITY_KEY];
const PANELS: readonly TrailerPanel[] = ["subtitles", "quality"];
// Les marges des feuilles, une par panneau, créées une fois (le port veut un conteneur stable).
const SHEET_BACK = {
  subtitles: createSheetBackGroup(trailerPanelCloseKey("subtitles")),
  quality: createSheetBackGroup(trailerPanelCloseKey("quality")),
} as const;

/** Le magasin de focus de l'écran, ses panneaux et ses ponts liés avant le premier rendu. */
export function useTrailerFocusStore(): FocusStore {
  const store = useFocusStore();
  useState(() => {
    for (const panel of PANELS) {
      const prefix = TRAILER_PANEL_PREFIX[panel];
      store.bind(`${prefix}:panel`, { container: TrapFocusGuide });
      store.bind(`${prefix}:back`, { container: SHEET_BACK[panel] });
    }
    for (const [key, container] of Object.entries(TRAILER_BRIDGES)) store.bind(key, { container });
  });
  return store;
}

const NO_ISLAND = { islandTrap: false, islandExit: false, activeSeasonIndex: 0 };

/** Le port du focus de l'écran, l'état que lisent les marges des feuilles et les ponts. */
export function TrailerFocusScope({ bridges, children }: { bridges: TrailerBridgeScope; children: ReactNode }) {
  const [state] = useState(() => ({ store: bridges.store, ...NO_ISLAND }));
  return (
    <PlayerFocusStateProvider value={state}>
      <TrailerBridgeProvider value={bridges}>
        <FocusBindingProvider bind={bridges.store.binder}>{children}</FocusBindingProvider>
      </TrailerBridgeProvider>
    </PlayerFocusStateProvider>
  );
}

/**
 * Le focus de l'écran : verrous, voisins, réclamations. `panelEntry` :
 * l'option qui prend le focus à l'ouverture d'un panneau. Rend
 * `onPanelExited` (à donner à la vue : le panneau refermé a fini de
 * s'effacer, le focus revient à son bouton) et ce que lisent les ponts.
 */
export function useTrailerFocus(
  store: FocusStore,
  view: TrailerFocusView,
  panelEntry: string | null,
): { onPanelExited: () => void; bridges: TrailerBridgeScope } {
  const viewRef = useRef(view);
  viewRef.current = view;
  const lastTool = useRef<string | null>(null);
  // L'état au dernier passage des réclamations : la lecture qui commence réclame l'entrée.
  const previousState = useRef<TrailerState | null>(null);
  // Un panneau refermé garde le focus le temps de s'effacer : rien ne se réclame avant.
  const closing = useRef<TrailerPanel | null>(null);
  const openPanel = useRef<TrailerPanel | null>(view.panel);
  if (view.panel !== openPanel.current) {
    if (view.panel === null && openPanel.current !== null) closing.current = openPanel.current;
    openPanel.current = view.panel;
  }

  const [bridges] = useState((): TrailerBridgeScope & { notify: () => void } => {
    const listeners = new Set<() => void>();
    return {
      store,
      readView: () => viewRef.current,
      readLastTool: () => lastTool.current,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      notify: () => listeners.forEach((listener) => listener()),
    };
  });

  const aim = useCallback((key: string) => {
    if ((TARGETS as readonly string[]).includes(key)) applyTrailerNeighbors(store, key, viewRef.current, lastTool.current);
  }, [store]);

  useEffect(() => store.subscribe((key, focused) => {
    if (!focused) return;
    if (TOOLS.includes(key) && lastTool.current !== key) {
      lastTool.current = key;
      bridges.notify();
    }
    aim(key);
  }), [store, aim, bridges]);

  const { state, chromeShown, panel } = view;
  const { subtitles, quality } = view.tools;
  useEffect(() => {
    const current = viewRef.current;
    for (const key of TARGETS) setFocusLocked(store, key, !trailerFocusable(key, current));
    bridges.notify();
    const focused = store.focusedKey();
    if (focused) aim(focused);
    const previous = previousState.current;
    previousState.current = current.state;
    if (closing.current !== null) return undefined;
    const claim = trailerStartClaim(previous, current) ?? trailerFocusClaim(current, focused);
    return claim ? store.claim(claim) : undefined;
  }, [store, aim, bridges, state, chromeShown, panel, subtitles, quality]);

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

  return { onPanelExited, bridges };
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
