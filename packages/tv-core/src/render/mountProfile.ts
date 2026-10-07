/**
 * Le PROFIL DE MONTAGE d'un niveau de rendu (`device/renderTier`) : combien
 * une page monte de vues natives, et quand. Le pendant du profil de rendu
 * (`renderProfile`, ce que les vues DESSINENT) pour ce qui se MONTE : les
 * rangées des pages (accueil, « Pour vous », fiche, recherche), la grille
 * des bibliothèques, les épisodes d'une saison.
 *
 * Règle commune : le montage ne se VOIT pas. Une carte hors de l'écran n'est
 * pas montée tant que le focus n'en approche pas ; quand il en approche, elle
 * l'est déjà. Disposition, voisins, Retour, défilement : identiques — seules
 * changent les vues qui existent hors de l'écran.
 *
 * Le niveau `normal` est le montage d'avant le mode Lite, à l'identique (sur
 * l'Apple TV, toujours celui-là). `lite` (Android TV faible, mesuré au banc
 * `lite.mjs` : chaque carte coûte ~30 vues natives) borne ce qui vit hors de
 * l'écran.
 */

import type { RenderTier } from "../device/renderTier";
import type { StagingTails } from "./rowStaging";

export interface ListWindow {
  /** Les éléments montés d'emblée. */
  initialNumToRender: number;
  /** La fenêtre montée, en écrans (celui du milieu est l'écran visible). */
  windowSize: number;
  /** Ce qu'un lot de plus monte, au plus. */
  maxToRenderPerBatch: number;
}

export interface MountProfile {
  /** Les queues des rangées échelonnées : montées en fond (`eager`), ou
   *  seulement quand la rangée est parcourue (`demanded`, `rowStaging`). */
  rowTails: StagingTails;
  /** La tête d'une rangée ajustée à ce qu'un écran en montre
   *  (`rowHeadCards`) : 5 vignettes 16:9 ou 7 affiches au lieu de 8. */
  fitRowHeads: boolean;
  /** Une rangée sortie de l'écran, ramenée au début (`rowRewindPort`),
   *  revient aussi à sa TÊTE : sa queue se démonte, et se remontera si on la
   *  parcourt de nouveau. */
  retireOffscreenRows: boolean;
  /** Les rangées de résultats de la recherche montées par échelons, comme
   *  celles de l'accueil (là où le profil de rendu échelonne). */
  stageSearchRows: boolean;
  /** Les cartes des résultats de la recherche RECYCLÉES d'une frappe à
   *  l'autre (clées par leur place) : une frappe redessine les cartes au lieu
   *  d'en monter d'autres (~175 vues natives créées par frappe, mesuré). */
  recycleSearchCards: boolean;
  /** Ce que la grille d'affiches garde montée au-delà de l'écran, en points,
   *  de chaque côté (`drawDistance` de FlashList : au chargement elle monte
   *  l'écran, puis s'étend jusqu'au triple, puis revient à cette valeur). */
  gridDrawDistance: number;
  /** L'avance de la grille dès que le focus quitte sa première ligne (au
   *  moins `gridDrawDistance`) : l'ouverture monte peu, le parcours garde la
   *  ligne suivante montée. */
  gridActiveDrawDistance: number;
  /** Le pas de cet élargissement, en points par image. */
  gridWidenStep: number;
  /** La fenêtre de la liste des épisodes d'une saison. */
  episodes: ListWindow;
}

export const MOUNT_PROFILES: Readonly<Record<RenderTier, Readonly<MountProfile>>> = {
  normal: {
    rowTails: "eager",
    fitRowHeads: false,
    retireOffscreenRows: false,
    stageSearchRows: false,
    recycleSearchCards: false,
    // Deux lignes d'avance de chaque côté (une ligne de six affiches : ~494 points).
    gridDrawDistance: 1100,
    gridActiveDrawDistance: 1100,
    gridWidenStep: 1100,
    // Les valeurs de React Native pour le lot (10) : celles d'avant.
    episodes: { initialNumToRender: 6, windowSize: 5, maxToRenderPerBatch: 10 },
  },
  lite: {
    rowTails: "demanded",
    fitRowHeads: true,
    retireOffscreenRows: true,
    stageSearchRows: true,
    recycleSearchCards: true,
    // L'ouverture : l'écran seul (à 0, FlashList ne s'étend pas au triple) —
    // la première ligne et le haut de la deuxième.
    gridDrawDistance: 0,
    // Le parcours : une ligne d'avance et son écart (437 à 494 points selon
    // les colonnes) — celle que BAS rejoint est montée, même avant que la
    // page ne défile vers la ligne focalisée.
    gridActiveDrawDistance: 600,
    // Une demi-ligne par image : ~3 affiches.
    gridWidenStep: 200,
    // Un écran de vignettes (≈ 3,4) et la suivante ; un écran de chaque côté.
    episodes: { initialNumToRender: 4, windowSize: 3, maxToRenderPerBatch: 2 },
  },
};

/** Le profil de montage d'un niveau de rendu. */
export function mountProfileOf(tier: RenderTier): Readonly<MountProfile> {
  return MOUNT_PROFILES[tier];
}
