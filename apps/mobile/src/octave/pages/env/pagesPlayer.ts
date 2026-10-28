/**
 * Octave mobile — le LECTEUR vu par les pages : l'`OctavePlayer` partagé
 * (`@tentacle-tv/shared/octave`) que le lecteur mobile pose sur la coquille
 * (`OctavePlayerProvider`, axe m2). Hors de lui (un écran rendu sans la
 * coquille), les boutons Lecture ne font rien et rien ne plante ; les listes
 * savent le titre en cours par `usePagesCurrentKey`.
 */

import { useSyncExternalStore } from "react";
import type { OctavePlayer, PlayerSnapshot } from "@tentacle-tv/shared/octave";
import { useOptionalOctavePlayer } from "../../player";

export function usePagesPlayer(): OctavePlayer | null {
  return useOptionalOctavePlayer();
}

const noop = () => () => undefined;

/** Une tranche de l'instantané du lecteur : le composant ne se redessine que si elle change. */
export function usePagesPlayerSelector<T>(select: (s: PlayerSnapshot) => T, fallback: T): T {
  const player = usePagesPlayer();
  const read = () => (player ? select(player.snapshot.get()) : fallback);
  return useSyncExternalStore(player ? player.snapshot.subscribe : noop, read, read);
}

/** La clé du titre en cours (`null` : rien) — pour marquer « en lecture » dans les listes. */
export function usePagesCurrentKey(): string | null {
  return usePagesPlayerSelector((s) => s.current?.key ?? null, null);
}

/** Le contexte de la file en cours (une carte d'album ou de mix se reconnaît). */
export function usePagesContextId(): string | null {
  return usePagesPlayerSelector((s) => s.queue.contextId ?? null, null);
}

/** Le lecteur veut jouer (lecture, chargement) ? */
export function usePagesWantsPlay(): boolean {
  return usePagesPlayerSelector((s) => s.wantsPlay, false);
}
