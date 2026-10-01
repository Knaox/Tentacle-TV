import { useEffect, useRef } from "react";
import type { FocusStore } from "../focus/focusStore";
import { useRemoteEvents, type RemoteDirection, type RemoteEvent } from "./remoteEvents";

/**
 * « Au-delà du bord » : un geste vers une direction où le focus ne va nulle
 * part — un clic sur le bord du pavé, une flèche, ou un glisser — alors que
 * le focus est sur l'élément du bord (`edgeKey`), et qu'il y était déjà
 * AVANT le geste.
 *
 * Le moteur de focus a traité le geste avant que l'événement n'arrive : un
 * appui déplace le focus à l'enfoncement et ne s'annonce qu'au relâchement ;
 * un glisser le déplace en cours de route et ne s'annonce qu'à la fin. Un
 * geste qui vient d'AMENER le focus sur le bord s'annonce donc avec le focus
 * déjà sur le bord : il ne compte pas — d'où l'arrivée datée, et
 * `SETTLE_MS`. Un événement, un appel : un titre par geste.
 *
 * Les appuis longs ne comptent pas (la Siri Remote n'en émet pas sur les
 * flèches, et un appui maintenu fait défiler le focus).
 */

/** Le temps que le focus doit avoir passé sur le bord avant le geste. Un
 *  glisser dure moins ; un appui qui y amène le focus s'annonce ~60 ms après
 *  lui (mesuré au simulateur). */
export const SETTLE_MS = 400;

export interface BeyondEdgeOptions {
  /** La clé du bord ; `null` : rien à écouter. */
  edgeKey: string | null;
  direction: RemoteDirection;
  /** Faux quand l'écran n'est pas devant (les écrans d'une pile restent montés). */
  enabled: boolean;
  onBeyond: () => void;
}

/** Vrai si l'événement est un geste vers `direction` (appui simple ou glisser). */
export function isGestureToward(event: RemoteEvent, direction: RemoteDirection): boolean {
  if (event.kind === "swipe") return event.direction === direction;
  return event.kind === "press" && event.button === direction && !event.long && event.phase !== "down";
}

export function useBeyondEdge(focus: FocusStore, { edgeKey, direction, enabled, onBeyond }: BeyondEdgeOptions): void {
  // L'arrivée du focus sur une clé, datée : un geste qui vient d'y amener le
  // focus n'est pas un geste « au-delà ».
  const arrival = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  useEffect(
    () =>
      focus.subscribe((key, focused) => {
        if (focused) arrival.current = { key, at: Date.now() };
      }),
    [focus],
  );

  const latest = useRef({ edgeKey, direction, onBeyond });
  latest.current = { edgeKey, direction, onBeyond };
  useRemoteEvents((event) => {
    const { edgeKey: edge, direction: toward, onBeyond: beyond } = latest.current;
    if (!edge || !isGestureToward(event, toward)) return;
    if (focus.focusedKey() !== edge) return;
    const { key, at } = arrival.current;
    if (key === edge && event.at - at < SETTLE_MS) return;
    beyond();
  }, enabled && edgeKey !== null);
}
