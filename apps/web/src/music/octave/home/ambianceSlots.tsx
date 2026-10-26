/**
 * Octave — les EMPLACEMENTS des ambiances (contrat M5 → M1, `contrats/slots.md`
 * du lot) : l'accueil et la recherche les montent déjà ; l'axe des ambiances y
 * rend ses composants (`moods/`). Sans extension qui déclare les ambiances :
 * rien, aucune trace. Les noms ne changent pas.
 */

import type { ReactNode } from "react";
import { MoodChips } from "../moods/MoodChips";
import { MoodResults } from "../moods/MoodResults";
import { MoodsShelf } from "../moods/MoodsShelf";

/** Accueil : après « Écoutés récemment », avant les mixes. Rend sa rangée entière (titre compris) ou rien. */
export function HomeMoodsSlot(): ReactNode {
  return <MoodsShelf />;
}

export interface SearchMoodsSlotProps {
  /** Valide une recherche (historique, `?q=`). */
  onSearch: (text: string) => void;
}

/** Recherche vide : en tête de page. Rend sa section entière ou rien. Une puce ouvre l'ambiance (pas une recherche). */
export function SearchHomeMoodsSlot(props: SearchMoodsSlotProps): ReactNode {
  void props;
  return <MoodChips />;
}

export interface SearchMoodResultsSlotProps extends SearchMoodsSlotProps {
  /** La recherche validée. */
  query: string;
}

/** Recherche validée : au-dessus des résultats, quand la requête nomme une ambiance ; sinon rien. */
export function SearchMoodResultsSlot(props: SearchMoodResultsSlotProps): ReactNode {
  return <MoodResults query={props.query} />;
}
