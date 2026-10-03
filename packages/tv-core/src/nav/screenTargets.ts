/**
 * OK sur un élément d'un écran qui n'est pas une carte : ce que joue la pilule
 * de lecture d'une fiche. Module pur : la plateforme navigue. (OK sur une
 * carte : `cards/cardPress` ; une fiche qui s'empile ou remplace la page :
 * `detailChain.ts`.)
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
