import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Destination du bouton « Lecture » d'une carte.
 *
 * Une série n'est pas lisible telle quelle : il faudrait résoudre l'épisode à
 * reprendre (`useSeriesWatchState`), soit une requête PAR CARTE — inacceptable
 * sur une rangée de dix affiches ou une grille de bibliothèque. On délègue donc
 * à la fiche détail, qui fait déjà cette résolution pour un seul item.
 * La bannière, elle, n'affiche qu'un item à la fois et peut se le permettre.
 */
export function playTargetPath(item: MediaItem): string {
  return item.Type === "Series" ? `/media/${item.Id}` : `/watch/${item.Id}`;
}
