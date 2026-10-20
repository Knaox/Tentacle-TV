import { useSyncExternalStore } from "react";

/**
 * La bascule hors connexion d'une session de PROFIL vers le compte de
 * l'appareil (`OfflineAccountFallback`), dite une fois : le message de passage
 * hors ligne porte une ligne de plus — « Retour au compte de cet appareil » —
 * jusqu'à ce qu'il s'efface ou que le réseau revienne.
 *
 * `happened` reste vrai pour la vie du processus : au retour du réseau, « Qui
 * regarde ? » ne s'impose pas (il suit sa règle au prochain démarrage à froid).
 */

/** Le nom du compte revenu ; `""` s'il est illisible ; null : rien à dire. */
let pending: string | null = null;
let happened = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function noteAccountFallback(accountName: string | null): void {
  pending = accountName ?? "";
  happened = true;
  emit();
}

export function clearAccountFallbackNotice(): void {
  if (pending === null) return;
  pending = null;
  emit();
}

/** Une bascule hors connexion a eu lieu pendant ce processus. */
export function accountFallbackHappened(): boolean {
  return happened;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Le nom du compte à dire (`""` : sans nom), ou null. */
export function useAccountFallbackNotice(): string | null {
  return useSyncExternalStore(subscribe, () => pending, () => pending);
}

/** Les tests repartent d'un processus neuf. */
export function resetAccountFallbackForTests(): void {
  pending = null;
  happened = false;
}
