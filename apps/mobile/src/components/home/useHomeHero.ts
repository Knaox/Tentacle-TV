import { useMemo } from "react";
import { useJellyfinClient, useMediaItem, useRecoHeroSlides, useRecoSettings } from "@tentacle-tv/api-client";
import type { HomeLayoutData, RecoRowItem } from "@tentacle-tv/api-client";
import { pickHeroMedia, type MediaItem } from "@tentacle-tv/shared";
import type { HeroSlide } from "@/components/hero/heroSlides";
import { mediaHeroSlides } from "@/components/hero/mediaHeroSlides";
import { recoHeroSlides } from "@/components/reco/hero/recoHeroSlides";

const EMPTY_FILTER: number[] = [];
const NO_SLIDES: HeroSlide[] = [];

interface HomeHeroInput {
  layout: HomeLayoutData | undefined;
  /** `undefined` tant que la source n'a pas répondu ; en échec : `[]`. */
  resume: MediaItem[] | undefined;
  featured: MediaItem[] | undefined;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
  onRecoOpen: (item: RecoRowItem) => void;
  canOpenReco: (item: RecoRowItem) => boolean;
}

/**
 * Le bandeau de l'accueil selon le mode du compte — le même contrat que le
 * web : `resume` (reprise, sinon mis en avant), `random` (mis en avant),
 * `fixed` (un titre choisi dans les favoris), `reco` (le carrousel de
 * recommandations, même entrée de cache que la page Pour vous). Tant que le
 * mode choisi n'a rien à montrer — chargement, profil froid, titre disparu —
 * la reprise tient le bandeau : jamais vide. Tous les hooks sont appelés
 * sans condition ; seul `enabled` varie.
 */
export function useHomeHero(input: HomeHeroInput): { slides: HeroSlide[]; loading: boolean } {
  const client = useJellyfinClient();
  const heroMode = input.layout?.heroMode ?? "resume";
  const settings = useRecoSettings();
  const settingsReady = settings.isSuccess || settings.isError;
  const recoHero = useRecoHeroSlides(settings.data?.providerFilter ?? EMPTY_FILTER, {
    enabled: heroMode === "reco" && settingsReady,
  });
  const fixedId = heroMode === "fixed" ? (input.layout?.heroFixedItemId ?? undefined) : undefined;
  const fixed = useMediaItem(fixedId);

  // La règle PARTAGÉE (shared `pickHeroMedia`, celle du web et de la TV) :
  // titre fixe effacé (404) → la reprise ; jamais un titre sans image.
  const fixedState = !fixedId ? null : (fixed.data ?? (fixed.isError ? null : undefined));
  const pick = useMemo(
    () => pickHeroMedia(heroMode, { resume: input.resume, featured: input.featured, fixed: fixedState }),
    [heroMode, input.resume, input.featured, fixedState],
  );
  const mediaItems = pick.items;
  const mediaSlides = useMemo(
    () => mediaHeroSlides(mediaItems, client, { onPlay: input.onPlay, onInfo: input.onInfo }),
    [mediaItems, client, input.onPlay, input.onInfo],
  );
  const recoSlides = useMemo(
    () => (heroMode === "reco"
      ? recoHeroSlides(recoHero.slides, client, { onOpen: input.onRecoOpen, canOpen: input.canOpenReco })
      : NO_SLIDES),
    [heroMode, recoHero.slides, client, input.onRecoOpen, input.canOpenReco],
  );

  const showReco = heroMode === "reco" && recoSlides.length > 0;
  const slides = showReco ? recoSlides : mediaSlides;
  // Ce que le mode attend n'a pas répondu : le squelette, pas un saut ensuite.
  const loading = !showReco && pick.pending;
  return { slides, loading };
}
