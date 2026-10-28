/**
 * Octave — « Déjà dans la playlist — l'ajouter quand même ? » (retour de Damien du 25/10) : un doublon reste
 * permis, jamais par mégarde. Une seule boîte par application, montée par la coquille (web : `DuplicateConfirmHost`,
 * mobile : sa feuille) ; les gestes la demandent par `askDuplicate` (une promesse : `true` = ajouter quand même).
 * Une demande nouvelle remplace l'ancienne, qui se résout en « non ».
 */

import { useSyncExternalStore } from "react";

export interface DuplicateAsk {
  title: string;
  playlist: string;
}

let current: (DuplicateAsk & { resolve: (confirmed: boolean) => void }) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function askDuplicate(title: string, playlist: string): Promise<boolean> {
  current?.resolve(false);
  return new Promise((resolve) => {
    current = { title, playlist, resolve };
    notify();
  });
}

/** La réponse de l'utilisateur (la boîte, et les tests). */
export function answerDuplicate(confirmed: boolean): void {
  const ask = current;
  current = null;
  notify();
  ask?.resolve(confirmed);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = (): DuplicateAsk | null => current;

/** La demande en cours, pour la boîte de l'application (`null` : rien à demander). */
export function useDuplicateAsk(): DuplicateAsk | null {
  return useSyncExternalStore(subscribe, read, read);
}
