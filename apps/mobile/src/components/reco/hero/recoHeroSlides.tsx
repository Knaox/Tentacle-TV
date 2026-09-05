import type { useJellyfinClient } from "@tentacle-tv/api-client";
import { recoAmbilightSourceUrl, recoBackdropUrl } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { TV_AMBILIGHT } from "@tentacle-tv/theme";
import type { HeroSlide } from "@/components/hero/heroSlides";
import { RecoHeroContent } from "./RecoHeroContent";

type JellyfinClient = ReturnType<typeof useJellyfinClient>;

interface RecoHeroHandlers {
  canOpen: (item: RecoRowItem) => boolean;
  onOpen: (item: RecoRowItem) => void;
}

/**
 * Les recommandations tirées pour le carrousel, en diapositives : visuel
 * large TMDB (sinon le backdrop Jellyfin d'un titre en bibliothèque), halo
 * depuis la même image en petit.
 */
export function recoHeroSlides(
  items: readonly RecoRowItem[],
  client: JellyfinClient,
  handlers: RecoHeroHandlers,
): HeroSlide[] {
  return items.map((item) => ({
    id: item.key,
    backdropUri: recoBackdropUrl(item, (id) => client.getImageUrl(id, "Backdrop", { width: 1280, quality: 85 })),
    haloUri: recoAmbilightSourceUrl(item, (id) =>
      client.getImageUrl(id, "Backdrop", { width: TV_AMBILIGHT.sourceWidth, quality: 70 }),
    ),
    render: (active) => (
      <RecoHeroContent item={item} active={active} canOpen={handlers.canOpen(item)} onOpen={handlers.onOpen} />
    ),
  }));
}
