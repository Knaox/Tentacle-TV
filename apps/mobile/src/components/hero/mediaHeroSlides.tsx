import type { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_AMBILIGHT } from "@tentacle-tv/theme";
import { HeroContent } from "@/components/HeroBannerContent";
import type { HeroSlide } from "./heroSlides";

type JellyfinClient = ReturnType<typeof useJellyfinClient>;

/* ── Source d'image (backdrop plein cadre + miniature du halo) ──────────── */

export function heroImageUrl(
  client: JellyfinClient,
  it: MediaItem,
  width = 1280,
  quality = 85,
): string | null {
  const isEp = it.Type === "Episode";
  const hasParentBackdrop = (it.ParentBackdropImageTags?.length ?? 0) > 0;
  const hasOwnBackdrop = (it.BackdropImageTags?.length ?? 0) > 0;
  if (!hasParentBackdrop && !hasOwnBackdrop && !it.ImageTags?.Primary) return null;
  const backdropId = isEp
    ? (hasParentBackdrop ? (it.ParentBackdropItemId ?? it.SeriesId ?? it.Id) : it.Id)
    : it.Id;
  return (hasParentBackdrop || hasOwnBackdrop)
    ? client.getImageUrl(backdropId, "Backdrop", { width, quality })
    : client.getImageUrl(it.Id, "Primary", { width, quality });
}

interface MediaHeroHandlers {
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}

/**
 * Les titres Jellyfin (reprise, mis en avant, sélection fixe) en diapositives.
 * La source du halo : l'affiche ACTIVE en petit (256 px, comme la TV) — le
 * flou mange les détails, la pleine résolution ne paierait que du transfert.
 */
export function mediaHeroSlides(
  items: readonly MediaItem[],
  client: JellyfinClient,
  handlers: MediaHeroHandlers,
): HeroSlide[] {
  return items.map((item) => ({
    id: item.Id,
    backdropUri: heroImageUrl(client, item),
    haloUri: heroImageUrl(client, item, TV_AMBILIGHT.sourceWidth, 70),
    render: (active) => (
      <HeroContent item={item} active={active} onPlay={handlers.onPlay} onInfo={handlers.onInfo} />
    ),
  }));
}
