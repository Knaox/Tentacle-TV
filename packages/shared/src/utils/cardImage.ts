import type { MediaItem } from "../types/media";

/** Image résolue : identifiant Jellyfin + type d'image à demander. */
export interface ResolvedCardImage {
  id: string;
  type: "Primary" | "Backdrop";
  /**
   * Tag de l'image quand la réponse le porte. Dans l'URL, il l'adresse par
   * CONTENU : Jellyfin remplace l'image → nouveau tag au prochain refetch du
   * rail → nouvelle URL → la carte repart de zéro (`CardImage` remet son état
   * quand `src` change). Sans lui l'URL était immuable, et une affiche
   * apparue APRÈS un 404 restait noire à vie.
   */
  tag?: string;
}

/**
 * `null` = la donnée PROUVE qu'il n'y a pas d'image : repli immédiat, zéro
 * requête. Avant, un item sans affiche était demandé quand même — 404 garanti,
 * et en RAFALE sur un rail entier en cours d'indexation Jellyfin (ou peint
 * depuis le cache persisté de 24 h) : toute la rangée passait au noir.
 *
 * Règle conservatrice : on ne conclut à l'absence QUE si la réponse porte
 * l'objet `ImageTags` (il est alors exhaustif pour l'item) ; champ absent, on
 * demande comme avant — mieux vaut un 404 rare qu'une affiche jamais demandée.
 */
function ownPrimary(item: MediaItem): ResolvedCardImage | null {
  const tag = item.ImageTags?.Primary;
  if (tag) return { id: item.Id, type: "Primary", tag };
  if (item.ImageTags !== undefined) return null;
  return { id: item.Id, type: "Primary" };
}

/**
 * La Primary de la SÉRIE. Son tag n'est porté que s'il existe, et son absence
 * ne prouve rien — `SeriesPrimaryImageTag` manque aussi quand la réponse ne
 * l'inclut pas. On demande donc toujours, avec le tag quand on l'a.
 */
function seriesPrimary(item: MediaItem, seriesId: string): ResolvedCardImage {
  const tag = item.SeriesPrimaryImageTag;
  return tag
    ? { id: seriesId, type: "Primary", tag }
    : { id: seriesId, type: "Primary" };
}

/**
 * Image 16:9 « bannière » pour les cartes EpisodeCard.
 *
 * Pour un épisode, on privilégie la VRAIE image de l'épisode (sa Primary, qui
 * est le still 16:9 réel) avant de retomber sur le backdrop de la série — c'est
 * l'inverse de l'ancien comportement, qui montrait toujours le backdrop série.
 * Priorité : Primary épisode → Backdrop épisode → Backdrop série → Primary série.
 * Pour un film : Backdrop propre → Primary.
 */
export function resolveBannerImage(item: MediaItem): ResolvedCardImage | null {
  const isEpisode = item.Type === "Episode";
  const primaryTag = item.ImageTags?.Primary;
  const backdropTag = item.BackdropImageTags?.[0];
  const parentBackdropTag = item.ParentBackdropImageTags?.[0];

  if (isEpisode) {
    if (primaryTag) return { id: item.Id, type: "Primary", tag: primaryTag };
    if (backdropTag) return { id: item.Id, type: "Backdrop", tag: backdropTag };
    if (parentBackdropTag) {
      return {
        id: item.ParentBackdropItemId ?? item.SeriesId ?? item.Id,
        type: "Backdrop",
        tag: parentBackdropTag,
      };
    }
    if (item.SeriesId) return seriesPrimary(item, item.SeriesId);
    return ownPrimary(item);
  }

  if (backdropTag) return { id: item.Id, type: "Backdrop", tag: backdropTag };
  return ownPrimary(item);
}

/** Mode d'affiche pour un épisode dans une carte 2:3. */
export type PosterImageMode = "auto" | "series";

/**
 * Image 2:3 « affiche » pour les cartes PosterCard.
 *
 * - `auto` (défaut) : pour un épisode, affiche réelle de l'épisode (sa Primary),
 *   repli sur le poster de la série.
 * - `series` : pour un épisode, on force le poster de la SÉRIE (plus propre dans
 *   « Derniers ajouts » où un still 16:9 rogné en 2:3 rend mal).
 */
export function resolvePosterImage(
  item: MediaItem,
  mode: PosterImageMode = "auto",
): ResolvedCardImage | null {
  if (item.Type === "Episode") {
    if (mode === "series" && item.SeriesId) return seriesPrimary(item, item.SeriesId);
    const primaryTag = item.ImageTags?.Primary;
    if (primaryTag) return { id: item.Id, type: "Primary", tag: primaryTag };
    if (item.SeriesId) return seriesPrimary(item, item.SeriesId);
  }
  return ownPrimary(item);
}
