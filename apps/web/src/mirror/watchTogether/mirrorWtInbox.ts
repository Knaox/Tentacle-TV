import { useSyncExternalStore } from "react";

/**
 * La boîte des invitations du web étroit, ouverte à la main (la bande de
 * l'accueil, « Invitations · N ») — l'ouverture d'office à l'accueil reste
 * celle du fournisseur (`onInviteArrived`).
 */
let open = false;
const listeners = new Set<() => void>();
const emit = (next: boolean) => {
  if (next === open) return;
  open = next;
  for (const listener of listeners) listener();
};

export const openMirrorWtInbox = (): void => emit(true);
export const closeMirrorWtInbox = (): void => emit(false);

export function useMirrorWtInbox(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => false,
  );
}
