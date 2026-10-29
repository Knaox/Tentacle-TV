/**
 * Octave — la règle de doublon d'un ajout GROUPÉ (« 2 des 5 titres sont déjà dans X ») : trois issues — tout ajouter,
 * ajouter sans les doublons, ou rien. Une seule demande à la fois pour toute l'application ; chaque client la REND
 * (web : `BulkDuplicateHost`, mobile : sa feuille), les gestes la demandent par `askBulkDuplicates`.
 */

import { useSyncExternalStore } from "react";
import type { DuplicateChoice } from "@tentacle-tv/shared/octave";

export interface BulkDuplicateAsk {
  duplicates: number;
  total: number;
  playlist: string;
}

let current: (BulkDuplicateAsk & { resolve: (choice: DuplicateChoice) => void }) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = (): BulkDuplicateAsk | null => current;

/** Une demande nouvelle remplace l'ancienne, qui se résout en « rien ». */
export function askBulkDuplicates(duplicates: number, total: number, playlist: string): Promise<DuplicateChoice> {
  current?.resolve("cancel");
  return new Promise((resolve) => {
    current = { duplicates, total, playlist, resolve };
    notify();
  });
}

/** La réponse de l'utilisateur (la boîte, la feuille, et les tests). */
export function answerBulkDuplicates(choice: DuplicateChoice): void {
  const ask = current;
  current = null;
  notify();
  ask?.resolve(choice);
}

export function useBulkDuplicateAsk(): BulkDuplicateAsk | null {
  return useSyncExternalStore(subscribe, read, read);
}
