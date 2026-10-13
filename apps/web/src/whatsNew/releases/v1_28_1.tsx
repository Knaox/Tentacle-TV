import type { WhatsNewRelease } from "../types";

/**
 * 1.28.1 — entrée VIDE, en connaissance de cause, comme la 1.25.5.
 *
 * Des correctifs, que le changelog dit lui-même « mineurs » : la vidéo quittée
 * qui ne joue plus en fond, « Lecture » qui ne se perd plus dans une page en
 * train de se fermer, la fiche d'un titre sans métadonnées qui s'ouvre (avec
 * son message et « Réanalyser maintenant » pour l'administrateur, serveur
 * 1.27.0), la série sans numéro de saison, la mise à jour par le Microsoft
 * Store. Chacun répare ce qui aurait dû marcher : aucun ne se met en scène.
 */
export const RELEASE_1_28_1: WhatsNewRelease = {
  version: "1.28.1",
  features: [],
};
