/**
 * La modale de SALLE Watch Together s'ouvre d'un seul endroit — le panneau de
 * la barre, la fiche d'un média, et demain le lecteur. Un état global plutôt
 * qu'un état de composant : elle est montée UNE fois, par le fournisseur,
 * au-dessus de tout (même motif que l'omnibox).
 *
 * - `room` : la salle — ce qu'elle regarde, qui est là, qui est invité ;
 * - `invite` : le choix des personnes à inviter.
 *
 * `fresh` : la salle vient d'être créée — l'en-tête le dit.
 */

import { useSyncExternalStore } from "react";

export type RoomModalView = "room" | "invite";

interface RoomModalState {
  open: boolean;
  view: RoomModalView;
  fresh: boolean;
}

let state: RoomModalState = { open: false, view: "room", fresh: false };
const listeners = new Set<() => void>();

function emit(next: RoomModalState): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openRoomModal(view: RoomModalView = "room", options: { fresh?: boolean } = {}): void {
  emit({ open: true, view, fresh: options.fresh ?? false });
}

export function showRoomView(view: RoomModalView): void {
  if (state.open) emit({ ...state, view });
}

export function closeRoomModal(): void {
  if (state.open) emit({ open: false, view: "room", fresh: false });
}

export function useRoomModal(): RoomModalState {
  return useSyncExternalStore(subscribe, () => state);
}
