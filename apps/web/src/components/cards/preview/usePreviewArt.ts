import { useJellyfinClient, useMediaItem } from "@tentacle-tv/api-client";
import { formatDuration, type MediaItem } from "@tentacle-tv/shared";
import { previewArtOf, previewNeedsDetail } from "./previewArt";

/** « 1963 · 1 h 54 » : l'année, et la durée d'un film. Rien d'inconnu n'est écrit. */
export function previewMetaOf(item: MediaItem | null): string | null {
  if (!item) return null;
  const parts = [
    item.ProductionYear ? String(item.ProductionYear) : null,
    item.Type === "Movie" ? formatDuration(item.RunTimeTicks) : null,
  ].filter((part): part is string => !!part);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Le logo et le fond que la mini-carte écrit sur la vidéo — ANNONCÉS par la
 * donnée, jamais demandés à l'aveugle.
 *
 * L'item d'une carte de rangée ou de grille n'annonce pas de logo (ses listes
 * ne demandent pas cette image) : on lit alors la FICHE du titre, sur la clé
 * de la page de détail (`["item", id]`, `useMediaItem`). Souvent déjà là
 * (carte de recherche, fiche visitée) ; sinon UNE requête, partie seulement
 * quand une bande-annonce va se montrer (la mini-carte n'est montée qu'à ce
 * moment) — et c'est la fiche que le clic sur la vidéo ouvre : elle s'ouvre
 * alors sans attendre. Tant qu'elle n'est pas là, le nom écrit, comme avant.
 */
export function usePreviewArt(
  artItem: MediaItem | null,
  detailItemId: string | null,
  backdropOverride: string | null,
): { logoUrl: string | null; backdropUrl: string | null; meta: string | null } {
  const client = useJellyfinClient();
  const id = artItem?.Id ?? detailItemId;
  const wanted = id !== null && previewNeedsDetail(artItem, backdropOverride === null);
  const { data: detail } = useMediaItem(wanted ? id : undefined, { enabled: wanted });
  const { logo, backdrop } = previewArtOf(artItem, wanted ? (detail ?? null) : null);
  return {
    meta: previewMetaOf(artItem) ?? previewMetaOf(wanted ? (detail ?? null) : null),
    logoUrl: logo ? client.getImageUrl(logo.id, "Logo", { height: 120, quality: 90, tag: logo.tag }) : null,
    backdropUrl: backdropOverride
      ?? (backdrop ? client.getImageUrl(backdrop.id, "Backdrop", { width: 780, quality: 80, tag: backdrop.tag }) : null),
  };
}
