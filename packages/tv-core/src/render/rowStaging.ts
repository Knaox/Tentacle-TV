/**
 * Le montage ÉCHELONNÉ des rangées d'une page (accueil, « Pour vous ») là où
 * le profil de rendu le demande (`stagedRows`, Android TV) : la page monte
 * d'emblée ce qui est à l'écran — les premières rangées, leurs premières
 * cartes —, puis UNE PART par image à l'heure (`STAGING_PACE`) : la tête de
 * chaque rangée suivante, puis la queue des rangées, par morceaux.
 *
 * Mesuré (banc `android-perf`, 2026-10-05) : l'accueil montait d'un bloc
 * ~2 450 vues natives, 235 ms de fil UI sur l'émulateur — de l'ordre de deux
 * secondes de gel sur la Shield, pendant l'entrée de la page. Ce qui ne se
 * voit pas encore ne retient plus ce qui se voit : chaque image ne crée plus
 * que quelques cartes, hors de l'écran.
 *
 * Module pur : l'ordre et le rythme des parts, l'horloge donnée, sans React.
 */

export const ROW_STAGING = {
  /** Les rangées montées d'emblée : la première, à l'écran sous le héros. La
   *  deuxième (sous le bord, à deux BAS) vient à l'image suivante — la
   *  première part de l'échelonnement. */
  headRows: 1,
  /** Les cartes d'une rangée montées d'emblée : un écran de large et la
   *  suivante (4,2 vignettes de 380 points, 6,3 affiches de 240). */
  headCards: 8,
  /** Ce qu'une image monte ensuite : deux cartes. Une carte, c'est ~15 vues
   *  natives, ~1,8 ms de fil UI sur l'émulateur (Apple M4) — de l'ordre de
   *  15 ms sur la Shield. Par quatre, chaque part y coûtait plusieurs images
   *  (des à-coups de 50 à 180 ms dès que l'émulateur ralentissait). */
  chunk: 2,
} as const;

/**
 * Le RYTHME des parts : une par image tant que les images tiennent leur
 * échéance. Une image arrivée en retard — le fil UI encore pris par la part
 * d'avant, un décodage, le ramasse-miettes — fait attendre la suivante : les
 * parts ne s'empilent jamais sur une image déjà en retard. Sans jamais laisser
 * la page à moitié montée : passé `maxWaitMs` sans part, la suivante part
 * quand même.
 */
export const STAGING_PACE = {
  /** L'intervalle d'affichage (60 Hz) ; à 50 Hz, une image à l'heure reste sous le seuil. */
  intervalMs: 1000 / 60,
  /** En retard : au-delà d'une fois et demie l'intervalle. */
  lateFactor: 1.5,
  /** Jamais plus longtemps sans une part (trois images). */
  maxWaitMs: 50,
} as const;

export interface StagingPacer {
  /** À chaque image (horodatage du rappel d'image, ms) : vrai si une part peut partir. */
  frame(now: number): boolean;
}

/** Le rythme d'un échelonnement (`STAGING_PACE`), l'horloge donnée à chaque image. */
export function createStagingPacer(): StagingPacer {
  let last: number | null = null;
  let lastRelease = Number.NEGATIVE_INFINITY;
  return {
    frame(now) {
      const late = last !== null && now - last > STAGING_PACE.intervalMs * STAGING_PACE.lateFactor;
      last = now;
      if (late && now - lastRelease < STAGING_PACE.maxWaitMs) return false;
      lastRelease = now;
      return true;
    },
  };
}

export interface StagedRow {
  /** Sa place dans la page, de haut en bas. */
  rank: number;
  /** Ses cartes. */
  total: number;
  /** Ses cartes déjà montées. */
  released: number;
  /** Elle a (eu) le focus : ce qui lui manque passe avant tout le reste — on
   *  la parcourt, sa queue ne doit jamais manquer sous le pouce. */
  demanded?: boolean;
}

/** Ce qu'une rangée garde quand elle quitte l'écran et que le profil la
 *  ramène à sa tête (`retireOffscreenRows`) : sa tête, rien de plus. */
export function headRelease(total: number): number {
  return Math.min(total, ROW_STAGING.headCards);
}

/** Ce qu'une rangée monte à son arrivée dans la page. */
export function initialRelease(rank: number, total: number): number {
  return rank < ROW_STAGING.headRows ? Math.min(total, ROW_STAGING.headCards) : 0;
}

/**
 * Ce que l'échelonnement monte de lui-même (le profil de montage du niveau de
 * rendu, `mountProfile`) : `eager`, les queues de toutes les rangées, en fond,
 * jusqu'à ce que la page soit montée entière ; `demanded`, les têtes
 * seulement — la queue d'une rangée ne se monte que quand elle est parcourue
 * (`demanded`). Une rangée a toujours sa tête : HAUT / BAS trouve donc
 * toujours ses cartes, au même endroit.
 */
export type StagingTails = "eager" | "demanded";

/**
 * La part suivante, `ROW_STAGING.chunk` cartes : d'abord ce qui manque à une
 * rangée qui a le FOCUS (`demanded`), puis la TÊTE de la plus haute rangée qui
 * n'a pas la sienne (la page se remplit de haut en bas, un écran de large),
 * puis la QUEUE de la plus haute rangée incomplète — sauf avec `tails:
 * "demanded"`, où une queue attend que sa rangée soit parcourue. `null` :
 * plus rien à monter.
 */
export function nextRelease(rows: readonly StagedRow[], tails: StagingTails = "eager"): { rank: number; released: number } | null {
  let demanded: StagedRow | null = null;
  let head: StagedRow | null = null;
  let tail: StagedRow | null = null;
  for (const row of rows) {
    if (row.released >= row.total) continue;
    const headTarget = Math.min(row.total, ROW_STAGING.headCards);
    if (row.demanded) {
      if (!demanded || row.rank < demanded.rank) demanded = row;
    } else if (row.released < headTarget) {
      if (!head || row.rank < head.rank) head = row;
    } else if (tails === "eager" && (!tail || row.rank < tail.rank)) {
      tail = row;
    }
  }
  if (demanded) return { rank: demanded.rank, released: Math.min(demanded.total, demanded.released + ROW_STAGING.chunk) };
  if (head) return { rank: head.rank, released: Math.min(Math.min(head.total, ROW_STAGING.headCards), head.released + ROW_STAGING.chunk) };
  if (tail) return { rank: tail.rank, released: Math.min(tail.total, tail.released + ROW_STAGING.chunk) };
  return null;
}
