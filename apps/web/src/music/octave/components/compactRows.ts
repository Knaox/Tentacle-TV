/**
 * Octave — les rangées de titre COMPACTES (téléphone) : la coquille du
 * téléphone les pose (`touch/OctavePhoneShell`), toute liste dessous les lit.
 * Une rangée garde alors ce qui se lit au doigt : la poignée (liste
 * réordonnable), la pochette — ou le numéro d'une piste d'album —, le titre,
 * le cœur et « … ». La case de sélection n'apparaît qu'en sélection (on y
 * entre par un appui long) ; la durée, l'ajout rapide et la colonne Album
 * partent (ils restent dans le menu et dans la page de l'album).
 * Hors du téléphone, rien ne change.
 */

import { createContext, useContext } from "react";

export const CompactRowsContext = createContext(false);

export function useCompactRows(): boolean {
  return useContext(CompactRowsContext);
}

export interface CompactColumns {
  handle: boolean;
  /** La case de sélection (en sélection seulement). */
  select: boolean;
  /** Le numéro (piste d'album, sans pochette). */
  number: boolean;
}

// Des classes ÉCRITES en entier : Tailwind ne voit que les chaînes littérales.
const COLUMNS: Record<string, string> = {
  "000": "grid-cols-[minmax(0,1fr)_auto]",
  "001": "grid-cols-[2rem_minmax(0,1fr)_auto]",
  "010": "grid-cols-[1.5rem_minmax(0,1fr)_auto]",
  "011": "grid-cols-[1.5rem_2rem_minmax(0,1fr)_auto]",
  "100": "grid-cols-[1.25rem_minmax(0,1fr)_auto]",
  "101": "grid-cols-[1.25rem_2rem_minmax(0,1fr)_auto]",
  "110": "grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_auto]",
  "111": "grid-cols-[1.25rem_1.5rem_2rem_minmax(0,1fr)_auto]",
};

/** La grille d'une rangée compacte, d'après les colonnes qu'elle montre. */
export function compactRowColumns({ handle, select, number }: CompactColumns): string {
  return COLUMNS[`${+handle}${+select}${+number}`];
}

type Handler = (...args: never[]) => void;

/** Deux jeux de gestes sur un même élément : chaque évènement appelle l'un PUIS l'autre (aucun n'écrase l'autre). */
export function chainHandlers<A extends object, B extends object>(a: A, b: B): A & B {
  const first = a as Record<string, Handler | undefined>;
  const second = b as Record<string, Handler | undefined>;
  const out: Record<string, Handler | undefined> = { ...first, ...second };
  for (const key of Object.keys(first)) {
    const one = first[key];
    const two = second[key];
    if (one && two) {
      out[key] = (...args: never[]) => {
        one(...args);
        two(...args);
      };
    }
  }
  return out as A & B;
}
