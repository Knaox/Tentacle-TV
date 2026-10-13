/**
 * « Un seul aperçu à la fois. » Deux cartes peuvent se croire survolées
 * ensemble — le pointeur sur l'une, le focus clavier sur l'autre, ou une
 * mini-carte encore en fondu quand la suivante démarre —, mais jamais deux
 * bandes-annonces ne jouent ni ne se chargent en même temps : la plus récente
 * prend la place, la précédente est évincée (`onPreempt`, qui rend l'évènement
 * `preempted` de la machine).
 *
 * Pur et sans DOM : le web en garde UNE instance au niveau du module.
 */
export interface TrailerPreviewArbiter {
  /** `holder` prend la place ; l'occupant précédent, s'il y en a un autre, est évincé. */
  claim(holder: object, onPreempt: () => void): void;
  /** Rend la place, si `holder` l'occupe encore (un évincé ne rend rien). */
  release(holder: object): void;
  /** L'occupant actuel, `null` si la place est libre. */
  current(): object | null;
}

export function createTrailerPreviewArbiter(): TrailerPreviewArbiter {
  let occupant: { holder: object; onPreempt: () => void } | null = null;
  return {
    claim(holder, onPreempt) {
      const previous = occupant;
      occupant = { holder, onPreempt };
      // Le même occupant qui redemande garde sa place (rendu répété) : personne n'est évincé.
      if (previous && previous.holder !== holder) previous.onPreempt();
    },
    release(holder) {
      if (occupant?.holder === holder) occupant = null;
    },
    current() {
      return occupant?.holder ?? null;
    },
  };
}
