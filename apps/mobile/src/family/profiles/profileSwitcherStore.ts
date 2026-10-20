import { useSyncExternalStore } from "react";

/**
 * L'ouverture de la feuille « Changer de profil » — appelable HORS React (la
 * puce de l'en-tête, Réglages › Compte, l'onglet Profil : `openProfileSwitcher()`).
 * La feuille se monte une fois à la racine (`ProfileSwitcherHost`) et ne
 * s'ouvre que si l'appareil peut changer de profil (`useCanSwitchProfile`).
 */

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function openProfileSwitcher(): void {
  if (open) return;
  open = true;
  emit();
}

export function closeProfileSwitcher(): void {
  if (!open) return;
  open = false;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useProfileSwitcherOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => open);
}
