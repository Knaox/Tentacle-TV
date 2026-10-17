/**
 * L'aperçu au focus dans une GRILLE d'affiches (Apple TV, Android TV) —
 * bibliothèque, Ma liste, Favoris, Parcourir.
 *
 * Chaque LIGNE de la grille est un CARROUSEL de l'accueil, sans titre
 * (demande du 17/10 : « le même comportement que l'accueil, ligne par
 * ligne »), et qui TOURNE (option C du 17/10, `trailerPreviewGridLine.ts`) :
 * au repos, ses affiches tiennent toutes à l'écran ; quand l'aperçu d'une
 * affiche démarre, sa cellule DEVIENT la grande carte (sa légende et son pied
 * passent dessous, jamais cachés) et la ligne défile pour la mettre EN TÊTE,
 * collée à la navigation — la place libre à droite remplie par le début de la
 * même ligne (les reprises). Seule la dernière affiche reste en BUTÉE, sa
 * grande carte à la marge de droite. Le focus parti (HAUT, BAS, la
 * navigation), la ligne revient d'elle-même à sa première colonne — la
 * grille reste une grille.
 *
 * En hauteur, la ligne qui grandit ne change pas la mise en page de la liste
 * (recyclée : la relayer à chaque image coûterait tout) : les lignes du
 * DESSOUS glissent d'autant que la cellule gagne (image et pied), sur le même
 * ressort, et la page descend si la ligne agrandie dépasse en bas.
 *
 * HAUT et BAS gardent la COLONNE (`gridLineEntries`, `focus/gridFocus.ts`) :
 * depuis une affiche passée en tête, la flèche ne mène pas sous elle (la
 * première colonne) mais à la même colonne de la ligne voisine.
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
