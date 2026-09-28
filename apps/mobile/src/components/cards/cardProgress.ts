import type { MediaItem } from "@tentacle-tv/shared";

/**
 * La progression qu'une carte dessine, de 0 à 100 — `null` : pas de barre.
 *
 * UNE règle pour toutes les cartes du mobile (affiches, grilles, vignettes,
 * lignes d'épisode) : non vu, et entamé. Un titre vu porte sa coche dans la
 * pastille d'états, jamais une barre pleine à côté ; chaque carte testait sa
 * propre condition, et une grille dessinait la barre d'un titre que la
 * rangée voisine taisait.
 */
export function cardProgress(item: Pick<MediaItem, "UserData">): number | null {
  const data = item.UserData;
  const percent = data?.PlayedPercentage;
  if (data?.Played === true || percent == null || !(percent > 0)) return null;
  return Math.min(percent, 100);
}
