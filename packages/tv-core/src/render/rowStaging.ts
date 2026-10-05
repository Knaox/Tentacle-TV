/**
 * Le montage ÉCHELONNÉ des rangées d'une page (accueil, « Pour vous ») là où
 * le profil de rendu le demande (`stagedRows`, Android TV) : la page monte
 * d'emblée ce qui est à l'écran — les premières rangées, leurs premières
 * cartes —, puis UNE PART par image : la tête de chaque rangée suivante, puis
 * la queue des rangées, par morceaux.
 *
 * Mesuré (banc `android-perf`, 2026-10-05) : l'accueil montait d'un bloc
 * ~2 450 vues natives, 235 ms de fil UI sur l'émulateur — de l'ordre de deux
 * secondes de gel sur la Shield, pendant l'entrée de la page. Ce qui ne se
 * voit pas encore ne retient plus ce qui se voit : chaque image ne crée plus
 * que quelques cartes, hors de l'écran.
 *
 * Module pur : l'ordre des parts, sans horloge ni React.
 */

export const ROW_STAGING = {
  /** Les rangées montées d'emblée : la première est à l'écran sous le héros,
   *  la deuxième à un BAS. */
  headRows: 2,
  /** Les cartes d'une rangée montées d'emblée : un écran de large et la
   *  suivante (4,2 vignettes de 380 points, 6,3 affiches de 240). */
  headCards: 8,
  /** Ce qu'une image monte ensuite : quatre cartes. */
  chunk: 4,
} as const;

export interface StagedRow {
  /** Sa place dans la page, de haut en bas. */
  rank: number;
  /** Ses cartes. */
  total: number;
  /** Ses cartes déjà montées. */
  released: number;
}

/** Ce qu'une rangée monte à son arrivée dans la page. */
export function initialRelease(rank: number, total: number): number {
  return rank < ROW_STAGING.headRows ? Math.min(total, ROW_STAGING.headCards) : 0;
}

/**
 * La part suivante : d'abord la TÊTE de la plus haute rangée qui n'a pas la
 * sienne (la page se remplit de haut en bas, un écran de large), puis la
 * QUEUE de la plus haute rangée incomplète, quatre cartes à la fois. `null` :
 * tout est monté.
 */
export function nextRelease(rows: readonly StagedRow[]): { rank: number; released: number } | null {
  let head: StagedRow | null = null;
  let tail: StagedRow | null = null;
  for (const row of rows) {
    if (row.released >= row.total) continue;
    const headTarget = Math.min(row.total, ROW_STAGING.headCards);
    if (row.released < headTarget) {
      if (!head || row.rank < head.rank) head = row;
    } else if (!tail || row.rank < tail.rank) {
      tail = row;
    }
  }
  if (head) return { rank: head.rank, released: Math.min(Math.min(head.total, ROW_STAGING.headCards), head.released + ROW_STAGING.chunk) };
  if (tail) return { rank: tail.rank, released: Math.min(tail.total, tail.released + ROW_STAGING.chunk) };
  return null;
}
