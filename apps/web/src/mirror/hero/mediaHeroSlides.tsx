import type { MediaItem } from "@tentacle-tv/shared";
import { HeroContent } from "./HeroContent";
import { HALO_SOURCE_WIDTH, heroImageUrl, heroPosterUrl, type HeroImageClient, type HeroSlide } from "./heroSlides";

/**
 * `mediaHeroSlides` de l'app : les titres Jellyfin (reprise, mis en avant,
 * sélection fixe) en diapositives. La source du halo est l'image affichée en
 * tout petit — le flou mange les détails.
 */
export function mediaHeroSlides(
  items: readonly MediaItem[],
  client: HeroImageClient,
  handlers: { onPlay: (item: MediaItem) => void; onInfo: (item: MediaItem) => void },
): HeroSlide[] {
  return items.map((item) => ({
    id: item.Id,
    backdropUri: heroImageUrl(client, item),
    haloUri: heroImageUrl(client, item, HALO_SOURCE_WIDTH, 70),
    posterUri: heroPosterUrl(client, item),
    haloPosterUri: heroPosterUrl(client, item, HALO_SOURCE_WIDTH, 70),
    render: (active) => <HeroContent item={item} active={active} onPlay={handlers.onPlay} onInfo={handlers.onInfo} />,
  }));
}
