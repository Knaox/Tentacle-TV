import { useMemo } from "react";
import {
  useJellyfinClient,
  useMediaItem,
  useRecoHeroSlides,
  type HomeLayoutData,
  type RecoRowItem,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
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

  const mediaItems = useMemo(() => {
    if (heroMode === "random") return featured ?? [];
    if (heroMode === "fixed" && fixed.data) return [fixed.data];
    return resume && resume.length > 0 ? resume.slice(0, 5) : (featured ?? []);
  }, [heroMode, featured, resume, fixed.data]);
  const mediaSlides = useMemo(
    () => mediaHeroSlides(mediaItems, client, { onPlay, onInfo }),
    [mediaItems, client, onPlay, onInfo],
  );
  const recoSlides = useMemo(
    () => (heroMode === "reco" ? recoHeroSlides(recoHero.slides, client, { onOpen: onRecoOpen, canOpen: canOpenReco }) : NO_SLIDES),
    [heroMode, recoHero.slides, client, onRecoOpen, canOpenReco],
  );

  const slides = heroMode === "reco" && recoSlides.length > 0 ? recoSlides : mediaSlides;
  // Sélection fixe en cours de chargement : le squelette, pas la reprise puis un saut.
  const loading = heroMode === "fixed" && !!fixedId && fixed.isPending;
  return { slides, loading };
}
