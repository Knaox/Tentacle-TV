import { useMemo } from "react";
import { useJellyfinClient, useMediaItem, useRecoHeroSlides, useRecoSettings } from "@tentacle-tv/api-client";
import type { HomeLayoutData, RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import type { HeroSlide } from "@/components/hero/heroSlides";
import { mediaHeroSlides } from "@/components/hero/mediaHeroSlides";
import { recoHeroSlides } from "@/components/reco/hero/recoHeroSlides";

const EMPTY_FILTER: number[] = [];
const NO_SLIDES: HeroSlide[] = [];

interface HomeHeroInput {
  layout: HomeLayoutData | undefined;
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

  const mediaItems = useMemo(() => {
    if (heroMode === "random") return input.featured ?? [];
    if (heroMode === "fixed" && fixed.data) return [fixed.data];
    return input.resume && input.resume.length > 0 ? input.resume.slice(0, 5) : input.featured ?? [];
  }, [heroMode, input.featured, input.resume, fixed.data]);
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

  const slides = heroMode === "reco" && recoSlides.length > 0 ? recoSlides : mediaSlides;
  // Sélection fixe en cours de chargement : le squelette, pas la reprise puis un saut.
  const loading = heroMode === "fixed" && !!fixedId && fixed.isPending;
  return { slides, loading };
}
