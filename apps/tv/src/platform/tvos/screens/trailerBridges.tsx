import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { FocusDestination } from "react-native";
import {
  TRAILER_CLOSE_KEY,
  TRAILER_TIMELINE_KEY,
  trailerNeighbor,
  type Direction,
  type TrailerFocusView,
} from "@tentacle-tv/tv-core";
import type { FocusGroupContainerProps } from "../../../redesign/focus/focusBinding";
import type { FocusStore } from "../focus/focusStore";
import { BridgeGuide } from "../player/playerFocusContainers";

/**
 * Les PONTS de la bande-annonce : rien d'aligné entre la croix (en haut à
 * gauche), les boutons (en bas à droite) et la barre (tout en bas) — la
 * géométrie de tvOS n'y suit pas les voisins de tv-core (`trailerNeighbor`),
 * et `nextFocus*` n'y est pas honoré. Deux guides, chacun avec un SENS lu sur
 * le focus, comme la frise du grand lecteur : armé seulement quand SA cible
 * de départ a le focus, il renvoie au voisin que tv-core désigne ; désarmé,
 * il n'est plus rien (`BridgeGuide`).
 * - `trailer:bridge-close`, sous la croix : BAS → le premier bouton ;
 * - `trailer:bridge-timeline`, entre les boutons et la barre : HAUT → le
 *   dernier bouton visité, sinon le premier, sinon la croix.
 */

export const TRAILER_CLOSE_BRIDGE = "trailer:bridge-close";
export const TRAILER_TIMELINE_BRIDGE = "trailer:bridge-timeline";

/** Ce que les ponts lisent de l'écran, et le signal de ses changements. */
export interface TrailerBridgeScope {
  store: FocusStore;
  readView: () => TrailerFocusView;
  readLastTool: () => string | null;
  /** L'écran a changé (chrome, boutons, panneau, dernier bouton) ; rend le désabonnement. */
  subscribe: (listener: () => void) => () => void;
}

const BridgeContext = createContext<TrailerBridgeScope | null>(null);
export const TrailerBridgeProvider = BridgeContext.Provider;

/** La destination du pont : le voisin de `from` vers `direction`, tant que `from` a le focus. */
function useArmedDestination(from: string, direction: Direction): FocusDestination[] {
  const scope = useContext(BridgeContext);
  const [destinations, setDestinations] = useState<FocusDestination[]>([]);
  const aim = useCallback(() => {
    if (!scope) return;
    const armed = scope.store.focusedKey() === from;
    const target = armed ? trailerNeighbor(from, direction, scope.readView(), scope.readLastTool()) : "stay";
    const node = target === "stay" ? null : (scope.store.node(target) as FocusDestination | null);
    setDestinations((prev) => (node ? (prev[0] === node ? prev : [node]) : prev.length ? [] : prev));
  }, [scope, from, direction]);
  useEffect(() => {
    if (!scope) return undefined;
    const offs = [scope.subscribe(aim), scope.store.subscribe(() => aim()), scope.store.subscribeNodes(() => aim())];
    aim();
    return () => offs.forEach((off) => off());
  }, [scope, aim]);
  return destinations;
}

function CloseBridge(props: FocusGroupContainerProps) {
  return <BridgeGuide {...props} destinations={useArmedDestination(TRAILER_CLOSE_KEY, "bas")} />;
}

function TimelineBridge(props: FocusGroupContainerProps) {
  return <BridgeGuide {...props} destinations={useArmedDestination(TRAILER_TIMELINE_KEY, "haut")} />;
}

/** Les groupes que l'écran lie, et leur guide. */
export const TRAILER_BRIDGES = {
  [TRAILER_CLOSE_BRIDGE]: CloseBridge,
  [TRAILER_TIMELINE_BRIDGE]: TimelineBridge,
} as const;
