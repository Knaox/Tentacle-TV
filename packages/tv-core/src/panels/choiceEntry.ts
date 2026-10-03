/**
 * Le VERROU D'ENTRÉE d'une liste ou d'un panneau présenté en `Modal` — le
 * grand panneau des cartes, la feuille des saisons, les listes de choix et de
 * filtres.
 *
 * Dans une `Modal`, tvOS n'honore aucune préférence de focus et focalise
 * l'élément du HAUT. La règle : à l'ouverture, toutes les cibles sont
 * infocalisables SAUF l'entrée — le système n'en trouve qu'une ; au premier
 * focus posé sur l'entrée, ou au filet (`CHOICE_ENTRY_RELEASE_MS`), toutes le
 * redeviennent, une seule fois. Une nouvelle entrée, liste ouverte (l'élément
 * focalisé a disparu), verrouille de nouveau : le système, qui cherche un
 * nouveau focus, n'en trouve encore qu'un.
 *
 * Pure : la machine dit QUELLES clés verrouiller et libérer, et quand. Le
 * branchement l'applique (sur tvOS, `isTVSelectable` — `focusable: false`
 * n'y fait rien —, posé AVANT que la liste ne se rende) et la nourrit : le
 * rendu (`enter`), le focus (`focused`), le filet (`timedOut`).
 */

/** Filet : si le premier focus tarde, les cibles se libèrent quand même. */
export const CHOICE_ENTRY_RELEASE_MS = 800;

/** Les verrous à poser quand l'entrée change : l'ancien lot à libérer, puis le nouveau à poser. */
export interface ChoiceEntryLocks {
  unlock: readonly string[];
  lock: readonly string[];
}

export interface ChoiceEntry {
  /**
   * Au RENDU, avant que la liste ne se rende : l'entrée du moment et toutes
   * les cibles. Rend les verrous à appliquer quand l'entrée a changé, sinon
   * `null`. Une entrée `null` (rien encore à focaliser) ne verrouille rien.
   */
  enter(keys: readonly string[], entry: string | null): ChoiceEntryLocks | null;
  /** Le focus est posé sur `key` : rend les clés à libérer si c'était l'entrée attendue. */
  focused(key: string): readonly string[] | null;
  /** Le filet de l'entrée en cours est écoulé : rend les clés à libérer, si rien ne l'a fait. */
  timedOut(): readonly string[] | null;
  /** L'entrée en cours attend encore sa libération. */
  waiting(): boolean;
}

export function createChoiceEntry(): ChoiceEntry {
  let opened: string | null = null;
  let locked: readonly string[] = [];
  let waiting = false;

  const release = (): readonly string[] | null => {
    if (!waiting) return null;
    waiting = false;
    const freed = locked;
    locked = [];
    return freed;
  };

  return {
    enter(keys, entry) {
      if (entry === opened) return null;
      const unlock = locked;
      locked = entry ? keys.filter((key) => key !== entry) : [];
      opened = entry;
      waiting = entry !== null;
      return { unlock, lock: locked };
    },
    focused(key) {
      return key === opened ? release() : null;
    },
    timedOut: release,
    waiting: () => waiting,
  };
}
