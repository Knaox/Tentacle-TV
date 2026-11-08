/**
 * Octave (mobile) — la position du lecteur à travers une GRAINE (`positionTicks.ts`) : le composant ne se redessine
 * que si la graine change, et plus du tout tant qu'il n'est pas vu (`live` faux : app derrière, lecteur plein écran
 * par-dessus). Il garde alors sa dernière image et se remet à jour d'un coup au retour (la graine est relue à
 * l'abonnement).
 */

import { useSyncExternalStore } from "react";
import type { PositionState } from "@tentacle-tv/shared/octave";
import { useOctavePlayer } from "./OctavePlayerContext";

const unsubscribed = () => () => undefined;

export function usePositionTick<T extends string | number>(live: boolean, tick: (position: PositionState) => T): T {
  const player = useOctavePlayer();
  const read = () => tick(player.position.get());
  return useSyncExternalStore(live ? player.position.subscribe : unsubscribed, read, read);
}
