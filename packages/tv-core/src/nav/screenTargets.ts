/**
 * OK sur un élément d'un écran : où l'on va — la lecture, une fiche, une
 * demande. Module pur : la plateforme navigue (et la suite de fiches,
 * `detailChain.ts`, dit si une fiche s'empile ou remplace la page).
 */

/** Ce que joue la pilule de lecture d'une fiche. */
export type DetailPlayPress =
  /** Lire cet identifiant. */
  | { kind: "play"; itemId: string }
  /** Une série dont l'état de visionnage se résout encore : le résoudre au geste. */
  | { kind: "resolve" }
  /** Une série terminée : rien (la pilule n'existe d'ailleurs pas). */
  | { kind: "none" };

/**
 * La pilule de lecture (FI-10) : le titre lui-même ; pour une SÉRIE,
 * l'épisode que dit son état de visionnage — jamais l'identifiant de la série.
 */
/** L'état de visionnage d'une série : terminée, ou l'épisode à lire. */
export type SeriesWatch = { completed: true } | { completed: false; episodeId: string };

export function detailPlayPress(item: { id: string; isSeries: boolean }, watch: SeriesWatch | undefined): DetailPlayPress {
  if (!item.isSeries) return { kind: "play", itemId: item.id };
  if (!watch) return { kind: "resolve" };
  return watch.completed ? { kind: "none" } : { kind: "play", itemId: watch.episodeId };
}

/** OK sur un volet de la saga d'un film. */
export type SagaEntryPress =
  /** « Cette fiche » : on y est. */
  | "none"
  /** Un volet de la bibliothèque : sa fiche. */
  | "open"
  /** Un volet absent, la garde des demandes ouverte : le demander. */
  | "request"
  /** Un volet absent sans garde : dire qu'il n'est pas dans la bibliothèque. */
  | "notInLibrary";

export function sagaEntryPress(entry: { current: boolean; absent: boolean; canRequest: boolean }): SagaEntryPress {
  if (entry.current) return "none";
  if (!entry.absent) return "open";
  return entry.canRequest ? "request" : "notInLibrary";
}
