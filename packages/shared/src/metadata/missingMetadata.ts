/**
 * Un titre que Jellyfin n'a pas (encore) trouvé : ni identifiant chez un
 * fournisseur (TMDB, IMDb, TVDB…), ni résumé — et, pour une saison ou un
 * épisode, une série qui n'a pas d'images non plus. C'est le cas d'un dossier
 * qui vient d'arriver, d'un nom que les fournisseurs ne reconnaissent pas, ou
 * d'un Jellyfin sans accès à ses sources de métadonnées.
 *
 * Une seule règle pour toutes les fiches (web, bureau, miroir, mobile,
 * téléviseurs) : elle décide quand poser le message discret « Les images et
 * les informations viennent de Jellyfin… », jamais un écran vide ni un
 * blocage — la fiche reste jouable.
 *
 * Faute de savoir, non : un titre lu sans `ProviderIds` (champ non demandé)
 * n'est pas déclaré « sans métadonnées » — le message paraîtrait puis
 * disparaîtrait, ou mentirait.
 */

import type { MediaItem } from "../types/media";

/** Les fiches concernées : une collection ou un album n'ont pas de métadonnées de fournisseur. */
export const METADATA_HINT_ITEM_TYPES: readonly MediaItem["Type"][] = ["Movie", "Series", "Season", "Episode"];

export type MetadataProbeItem = Pick<
  MediaItem,
  "Type" | "Overview" | "ProviderIds" | "SeriesPrimaryImageTag" | "ParentBackdropImageTags" | "ParentLogoImageTag"
>;

const filled = (value: unknown): boolean => typeof value === "string" && value.trim() !== "";

/** Au moins un identifiant de fournisseur renseigné : Jellyfin a reconnu le titre. */
export function hasProviderIdentity(providerIds: MediaItem["ProviderIds"]): boolean {
  return !!providerIds && Object.values(providerIds).some(filled);
}

/**
 * La série d'une saison ou d'un épisode a ses images : elle a été trouvée,
 * l'épisode n'est qu'en retard (un épisode récent sans résumé, par exemple).
 */
function parentWasFound(item: MetadataProbeItem): boolean {
  return filled(item.SeriesPrimaryImageTag)
    || (item.ParentBackdropImageTags?.length ?? 0) > 0
    || filled(item.ParentLogoImageTag);
}

/**
 * Le titre manque-t-il de métadonnées ? Vrai seulement quand c'est ÉTABLI :
 * type concerné, identifiants lus et tous vides, aucun résumé, et (saison,
 * épisode) une série sans images.
 */
export function lacksMetadata(item: MetadataProbeItem | null | undefined): boolean {
  if (!item || !METADATA_HINT_ITEM_TYPES.includes(item.Type)) return false;
  // Champ non demandé : on ne sait pas, on se tait.
  if (item.ProviderIds === undefined || item.ProviderIds === null) return false;
  if (hasProviderIdentity(item.ProviderIds)) return false;
  if (filled(item.Overview)) return false;
  if ((item.Type === "Season" || item.Type === "Episode") && parentWasFound(item)) return false;
  return true;
}
