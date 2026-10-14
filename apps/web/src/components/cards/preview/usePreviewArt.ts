import { useMemo } from "react";
import { useJellyfinClient, useMediaItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { previewArtOf, previewNeedsDetail, previewStillUrlOf } from "./previewArt";
import { previewInfoOf, type PreviewInfo } from "./previewInfo";

/** L'année d'une ligne donnée par la carte (« 2016 ») — ce que disent les cartes sans item. */
function yearOf(meta: string | null): number | null {
  const match = meta ? /^\s*(\d{4})\b/.exec(meta) : null;
  return match ? Number(match[1]) : null;
}

/**
 * Le logo, le fond et les infos du bandeau — ANNONCÉS par la donnée, jamais
 * demandés à l'aveugle.
 *
 * L'item d'une carte de rangée ou de grille n'annonce pas de logo (ses listes
 * ne demandent pas cette image) : on lit alors la FICHE du titre, sur la clé
 * de la page de détail (`["item", id]`, `useMediaItem`). Souvent déjà là
 * (carte de recherche, fiche visitée) ; sinon UNE requête, partie seulement
 * quand une bande-annonce va se montrer (la mini-carte n'est montée qu'à ce
 * moment) — et c'est la fiche que le clic sur la vidéo ouvre : elle s'ouvre
 * alors sans attendre. Tant qu'elle n'est pas là, le nom écrit, comme avant.
 *
 * Les infos du bandeau (`previewInfo.ts`) se lisent sur la carte, puis sur
 * cette même fiche : genres, classification, qualité arrivent avec elle, sans
 * rien demander de plus. `meta` : l'année que donne une carte sans item
 * (recommandation, titre hors bibliothèque).
 */
export function usePreviewArt(
  artItem: MediaItem | null,
  detailItemId: string | null,
  backdropOverride: string | null,
  meta: string | null = null,
): { logoUrl: string | null; backdropUrl: string | null; info: PreviewInfo } {
  const client = useJellyfinClient();
  const id = artItem?.Id ?? detailItemId;
  const wanted = id !== null && previewNeedsDetail(artItem, backdropOverride === null);
  const { data } = useMediaItem(wanted ? id : undefined, { enabled: wanted });
  const detail = wanted ? (data ?? null) : null;
  const { logo } = previewArtOf(artItem, detail);
  const fallbackYear = yearOf(meta);
  const info = useMemo(() => previewInfoOf(artItem, detail, fallbackYear), [artItem, detail, fallbackYear]);
  return {
    info,
    logoUrl: logo ? client.getImageUrl(logo.id, "Logo", { height: 120, quality: 90, tag: logo.tag }) : null,
    backdropUrl: previewStillUrlOf((id, type, options) => client.getImageUrl(id, type, options), artItem, backdropOverride, detail),
  };
}
