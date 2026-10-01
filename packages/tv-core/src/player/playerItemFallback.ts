import type { MediaItem } from "@tentacle-tv/shared";

/**
 * La fiche du lecteur quand Tentacle ne répond plus.
 *
 * Le flux attend la fiche complète : sans elle, ni conteneur, ni pistes, ni
 * reprise. Tentacle coupé, elle échouait au bout de 14 s (deux échelles de
 * relances) et le flux partait à l'aveugle — transcodage depuis 0:00, mesuré
 * sur un film à reprendre à 1:23 qui se lisait en direct une minute plus tôt.
 *
 * Deux recours, dans cet ordre, et seulement quand le serveur ne répond pas
 * (sa fiche porte la reprise la plus fraîche) :
 * 1. la fiche déjà en CACHE (cartes de l'accueil, épisodes d'une saison,
 *    Ma liste…), si elle est jouable ;
 * 2. sinon, la fiche lue EN DIRECT chez Jellyfin, avec le jeton de l'appareil
 *    — impossible en mode proxy (aucun jeton) : on en reste alors au
 *    comportement d'avant.
 */

/** Le temps laissé à la fiche du serveur avant de demander si Tentacle répond. */
export const ITEM_FALLBACK_AFTER_MS = 1500;

/**
 * Une fiche JOUABLE porte sa source et les pistes de celle-ci : c'est ce que
 * lit le flux (lecture directe, pistes, reprise). Les rangées qui demandent
 * `MediaSources` en donnent ; une carte sans source, non.
 */
export function isPlayableItem(item: MediaItem | null | undefined): item is MediaItem {
  const source = item?.MediaSources?.[0];
  return !!source?.MediaStreams?.some((stream) => stream.Type === "Video");
}

/**
 * Faut-il chercher la fiche ailleurs ? Jamais tant que le serveur l'a rendue ;
 * dès que sa requête a échoué, ou qu'une sonde le dit muet (`null` : pas
 * encore sondé).
 */
export function needsItemFallback(s: {
  hasServerItem: boolean;
  serverFailed: boolean;
  tentacleSilent: boolean | null;
}): boolean {
  if (s.hasServerItem) return false;
  return s.serverFailed || s.tentacleSilent === true;
}

export type ItemFallbackPlan = "cache" | "direct" | "none";

/** Le recours à prendre : le cache s'il est jouable, sinon la lecture directe si le direct est configuré. */
export function itemFallbackPlan(s: { cached: MediaItem | null | undefined; directAvailable: boolean }): ItemFallbackPlan {
  if (isPlayableItem(s.cached)) return "cache";
  return s.directAvailable ? "direct" : "none";
}
