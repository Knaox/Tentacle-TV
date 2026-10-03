import { useEffect, useRef } from "react";
import { arrivalAfterFocus, isBeyondEdge, NO_FOCUS_ARRIVAL, type Direction, type FocusArrival } from "@tentacle-tv/tv-core";
import { tvosInput, useRemoteIntents } from "../input";
import type { FocusStore } from "./focusStore";

/**
 * « Au-delà du bord » : un geste vers une direction où le focus ne va nulle
 * part — un clic sur le bord du pavé, une flèche, ou un glisser — alors que
 * le focus est sur l'élément du bord (`edgeKey`), et qu'il y était déjà AVANT
 * le geste. La décision est la règle de tv-core (`focus/beyondEdge.ts`), qui
 * lit les faits de la Siri Remote dans sa table : le moteur de focus a déjà
 * déplacé le focus quand l'intention arrive, et un appui ne s'annonce qu'au
 * relâchement. Ce crochet date les arrivées du focus et écoute les
 * intentions de l'entrée unique. Un événement, un appel : un titre par geste.
 */

export interface BeyondEdgeOptions {
  /** La clé du bord ; `null` : rien à écouter. */
  edgeKey: string | null;
  direction: Direction;
  /** Faux quand l'écran n'est pas devant (les écrans d'une pile restent montés). */
  enabled: boolean;
  onBeyond: () => void;
}

export function useBeyondEdge(focus: FocusStore, { edgeKey, direction, enabled, onBeyond }: BeyondEdgeOptions): void {
  // L'arrivée du focus sur une clé, datée : un geste qui vient d'y amener le
  // focus n'est pas un geste « au-delà ».
  const arrival = useRef<FocusArrival>(NO_FOCUS_ARRIVAL);
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        arrival.current = arrivalAfterFocus(arrival.current, key, focused, Date.now());
      }),
    [focus],
  );

  const latest = useRef({ edgeKey, direction, onBeyond });
  latest.current = { edgeKey, direction, onBeyond };
  useRemoteIntents((event) => {
    const { edgeKey: edge, direction: toward, onBeyond: beyond } = latest.current;
    const input = { edgeKey: edge, direction: toward, focusedKey: focus.focusedKey(), arrival: arrival.current, traits: tvosInput.bindings.traits };
    if (isBeyondEdge(event, input)) beyond();
  }, enabled && edgeKey !== null);
}
