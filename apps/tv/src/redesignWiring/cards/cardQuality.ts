import { qualityBadgesOf, type MediaItem } from "@tentacle-tv/shared";
import type { CardQuality } from "../../redesign/cards/cardTypes";

/**
 * Ce qu'une carte sait de la qualité de son titre (`CardQuality`) :
 * - l'item porte ses flux (une liste qui a demandé les sources, une fiche) :
 *   ses badges, tout de suite — et rien du tout s'il n'en a aucun ;
 * - un film ou un épisode sans ses flux (une grille, l'accueil) : à lire AU
 *   FOCUS, par la source de la qualité (`qualityBadgeStore`) ;
 * - une série, ou tout autre chose : rien — sa qualité ne se lit pas sans
 *   requêtes de plus.
 */
export function cardQualityOf(item: MediaItem): CardQuality | undefined {
  const known = qualityBadgesOf(item);
  if (known) return known.length > 0 ? { badges: known } : undefined;
  return item.Type === "Movie" || item.Type === "Episode" ? { probe: item.Id } : undefined;
}

/** Deux qualités de carte disent-elles la même chose ? (Les listes de badges
 *  sont partagées par combinaison : l'identité suffit.) */
export function sameQuality(a: CardQuality | undefined, b: CardQuality | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if ("probe" in a) return "probe" in b && a.probe === b.probe;
  return "badges" in b && a.badges === b.badges;
}
