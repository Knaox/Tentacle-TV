import { useMemo } from "react";
import {
  useJellyfinClient,
  useMediaItem,
  useRecoHeroSlides,
  type HomeLayoutData,
  type RecoRowItem,
} from "@tentacle-tv/api-client";
import { pickHeroMedia, type MediaItem } from "@tentacle-tv/shared";
import { useRecoFilter } from "../../../hooks/useRecoFilter";
import type { HeroSlide } from "../../hero/heroSlides";
import { mediaHeroSlides } from "../../hero/mediaHeroSlides";
import { recoHeroSlides } from "../forYou/RecoHeroContent";

const NO_SLIDES: HeroSlide[] = [];

/**
 * `useHomeHero` de l'app : le bandeau selon le mode du compte — `resume`
 * (reprise, sinon mis en avant), `random` (mis en avant), `fixed` (un titre
 * choisi), `reco` (le carrousel de Pour vous, même entrée de cache). Tant que
 * le mode n'a rien à montrer, la reprise tient le bandeau : jamais vide.
 */
export function useHomeHero(input: {
  layout: HomeLayoutData | undefined;
  /** `undefined` tant que la source n'a pas répondu ; en échec : `[]`. */
  resume: MediaItem[] | undefined;
  featured: MediaItem[] | undefined;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
  onRecoOpen: (item: RecoRowItem) => void;
  canOpenReco: (item: RecoRowItem) => boolean;
}): { slides: HeroSlide[]; loading: boolean } {
  const client = useJellyfinClient();
  const { layout, resume, featured, onPlay, onInfo, onRecoOpen, canOpenReco } = input;
  const heroMode = layout?.heroMode ?? "resume";
  const { selected } = useRecoFilter();
  const recoHero = useRecoHeroSlides(selected, { enabled: heroMode === "reco" });
  const fixedId = heroMode === "fixed" ? (layout?.heroFixedItemId ?? undefined) : undefined;
  const fixed = useMediaItem(fixedId);

  // La règle PARTAGÉE (shared `pickHeroMedia`, celle du bureau et de la TV) :
  // titre fixe effacé (404) → la reprise ; jamais un titre sans image.
  const fixedState = !fixedId ? null : (fixed.data ?? (fixed.isError ? null : undefined));
  const pick = useMemo(
    () => pickHeroMedia(heroMode, { resume, featured, fixed: fixedState }),
    [heroMode, resume, featured, fixedState],
  );
  const mediaItems = pick.items;
  const mediaSlides = useMemo(
    () => mediaHeroSlides(mediaItems, client, { onPlay, onInfo }),
    [mediaItems, client, onPlay, onInfo],
  );
  const recoSlides = useMemo(
    () => (heroMode === "reco" ? recoHeroSlides(recoHero.slides, client, { onOpen: onRecoOpen, canOpen: canOpenReco }) : NO_SLIDES),
    [heroMode, recoHero.slides, client, onRecoOpen, canOpenReco],
  );

  const showReco = heroMode === "reco" && recoSlides.length > 0;
  const slides = showReco ? recoSlides : mediaSlides;
  // Ce que le mode attend n'a pas répondu : le squelette, pas un saut ensuite.
  const loading = !showReco && pick.pending;
  return { slides, loading };
}
