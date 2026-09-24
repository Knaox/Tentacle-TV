import type { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { TV_AMBILIGHT } from "@tentacle-tv/theme";
import { HeroContent } from "@/components/HeroBannerContent";
import { heroImageUrl, heroPosterUrl } from "./heroImages";
import type { HeroSlide } from "./heroSlides";

type JellyfinClient = ReturnType<typeof useJellyfinClient>;

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
    posterUri: heroPosterUrl(client, item),
    haloPosterUri: heroPosterUrl(client, item, TV_AMBILIGHT.sourceWidth, 70),
    render: (active) => (
      <HeroContent item={item} active={active} onPlay={handlers.onPlay} onInfo={handlers.onInfo} />
    ),
  }));
}
