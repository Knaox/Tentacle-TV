/**
 * Ce qui fait UNE saison, du point de vue de l'utilisateur : son NUMÉRO.
 *
 * Pas son identifiant : une même saison peut en porter plusieurs côté Jellyfin
 * — mesuré sur Naruto, dont la saison 3 existe en deux entités de 56 épisodes
 * au total. Grouper par identifiant affichait deux lignes « Saison 3 », et
 * cocher l'une n'en décochait que la moitié. Le numéro manque (épisodes hors
 * saison) : on retombe sur l'identifiant, faute de mieux.
 *
 * Les deux dialogues de mise hors ligne — celui du téléphone et celui du
 * bureau — regroupent et filtrent par cette clé. Une seule implémentation :
 * deux copies auraient divergé sur ce repli, qui est tout le sujet.
 */

import type { MediaItem } from "@tentacle-tv/shared";

export function seasonKey(episode: MediaItem): string {
  const number = episode.ParentIndexNumber;
  if (typeof number === "number") return `n${number}`;
  return episode.SeasonId ?? "n?";
}
