/**
 * L'aperçu au focus dans une GRILLE d'affiches (Apple TV, Android TV) —
 * bibliothèque, Ma liste, Favoris, Parcourir.
 *
 * Une ligne de grille est FIXE (décision du 18/10, qui remplace la ligne qui
 * tournait du 17/10) : elle ne défile pas, ne tourne pas, rien n'y grandit.
 * GAUCHE et DROITE ne font que déplacer le focus ; l'aperçu de l'affiche
 * focalisée se joue dans la zone fixe en haut de l'écran, toujours au même
 * endroit (façon Netflix), jamais dans la grille. HAUT et BAS gardent la
 * COLONNE (`gridLineEntries`, `focus/gridFocus.ts`).
 *
 * Ce qui reste ici : la préparation des aperçus autour du focus, et le
 * plancher qui n'en demande aucun tant que la grille défile.
 */

/**
 * La fenêtre de préparation d'une grille autour de sa carte focalisée :
 * `[début, fin[` — sa ligne et la suivante, celle où BAS mène. Bornée :
 * deux lignes au plus, quelle que soit la taille du catalogue.
 */
export function gridTrailerPreviewWarmWindow(index: number, count: number, columns: number): [number, number] {
  const perLine = Math.max(1, Math.floor(columns));
  const start = Math.max(0, Math.min(count, Math.floor(index / perLine) * perLine));
  return [start, Math.min(count, start + 2 * perLine)];
}

/**
 * La grille est POSÉE quand ni le focus ni la page n'ont bougé depuis
 * `GRID_PREVIEW_SETTLE_MS` : avant, ni aperçu ni préparation. Le focus seul ne
 * suffit pas à le dire — en défilement accéléré (flèche tenue), tvOS ne
 * prévient l'app que d'un focus de temps en temps (un toutes les deux
 * secondes, mesuré), alors que la page défile toujours : c'est le défilement
 * qui dit que la grille bouge.
 */
export const GRID_PREVIEW_SETTLE_MS = 300;

/** Dans combien de temps la grille sera posée (ms ; 0 : elle l'est), depuis son dernier mouvement. */
export function gridPreviewSettleDelay(lastMoveAt: number | null, now: number, settleMs = GRID_PREVIEW_SETTLE_MS): number {
  if (lastMoveAt === null) return 0;
  return Math.max(0, lastMoveAt + settleMs - now);
}

/** Au-delà de tant de lignes défilées depuis le focus qu'elle connaît, l'app est en retard sur la page. */
export const GRID_FOCUS_OUTRUN_LINES = 1.5;

/**
 * Le focus que l'app connaît est DÉPASSÉ : la page a défilé de plus d'une
 * ligne et demie depuis qu'elle l'a reçu — un pas de flèche n'en fait jamais
 * défiler plus d'une. C'est le défilement accéléré de tvOS, dont l'app ne
 * reçoit qu'un focus de temps en temps : la carte qu'elle croit focalisée est
 * déjà loin, son aperçu ne se demande pas. Un pas simple, lui, ne retarde rien.
 * Une fois la grille POSÉE (`gridPreviewSettleDelay`), son focus est le vrai :
 * on repart de là — un focus reçu pendant que la page filait encore vers lui ne
 * reste jamais « dépassé ».
 */
export function gridFocusOutrun(scrollAtFocus: number, scrollNow: number, lineStride: number): boolean {
  return Math.abs(scrollNow - scrollAtFocus) > GRID_FOCUS_OUTRUN_LINES * Math.max(1, lineStride);
}
