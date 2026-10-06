import { useEffect, useMemo, useRef, useState } from "react";
import { useFeaturedItems, useHomeLayout, useMediaItem, useResumeItems, type RecoRowItem } from "@tentacle-tv/api-client";
import { hasHeroImage, type MediaItem } from "@tentacle-tv/shared";
import {
  HERO_SOURCE_WAIT_MS,
  heroItemsFrom,
  heroModeOf,
  heroSourceFor,
  type HeroInputs,
  type HeroMode,
  type HeroSource,
} from "@tentacle-tv/tv-core";
import { useHomeRecoHero } from "./useHomeRecoHero";

export interface HeroSources {
  items: MediaItem[];
  /** D'où viennent les titres ; `null` : pas encore connu — l'accueil attend. */
  source: HeroSource | null;
  /** La recommandation d'un titre tiré de « Pour vous » (sa raison). */
  recoOf: ReadonlyMap<string, RecoRowItem>;
}

const NONE: MediaItem[] = [];

/** Une source en échec ne s'attend plus : elle vaut « rien » (une identité stable : le héros ne se refait pas). */
function settledList(query: { data?: MediaItem[]; isError: boolean }): MediaItem[] | undefined {
  return query.data ?? (query.isError ? NONE : undefined);
}

/**
 * Les seuls titres qui ANNONCENT une image (shared `hasHeroImage`, la règle du
 * web et du mobile) : Jellyfin 10.11 ignore `HasBackdrop` dans la sélection
 * (mesuré), et un titre sans image laissait un héros sans décor. Une source
 * qui n'en garde aucun cède la place au repli de tv-core.
 */
function withImage(list: readonly MediaItem[] | undefined): MediaItem[] | undefined {
  if (!list) return undefined;
  return list.every(hasHeroImage) ? (list as MediaItem[]) : list.filter(hasHeroImage);
}

/**
 * Les titres du héros selon le mode que le compte a choisi — gardé par le
 * SERVEUR (`useHomeLayout`, la mise en page de l'accueil, persistée : connue
 * dès le démarrage à froid), le même que le web, le bureau et le mobile. Les
 * règles sont celles de tv-core (`hero/heroSource.ts`) : ici, seulement les
 * lectures.
 */
export function useHeroSources(): HeroSources {
  const layoutQuery = useHomeLayout();
  const mode = heroModeOf(layoutQuery.data, layoutQuery.isError);
  const resumeList = settledList(useResumeItems());
  const featuredList = settledList(useFeaturedItems());
  const resume = useMemo(() => withImage(resumeList), [resumeList]);
  const featured = useMemo(() => withImage(featuredList), [featuredList]);

  const fixedId = mode === "fixed" ? (layoutQuery.data?.heroFixedItemId ?? undefined) : undefined;
  const fixedQuery = useMediaItem(fixedId);
  // Le titre fixe effacé (404) ou sans aucune image : « aucun », le repli.
  const fixedData = fixedQuery.data?.Id === fixedId ? fixedQuery.data : undefined;
  const fixed = !fixedId ? null : fixedData ? (hasHeroImage(fixedData) ? fixedData : null) : fixedQuery.isError ? null : undefined;

  const reco = useHomeRecoHero(mode === "reco");

  // L'attente bornée d'une source lente : la reprise prend le relais.
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitedOut(true), HERO_SOURCE_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const inputs = useMemo<HeroInputs<MediaItem>>(
    () => ({ resume, featured, fixed, reco: withImage(reco.items) }),
    [resume, featured, fixed, reco.items],
  );
  // La source déjà montrée reste, tant que le mode ne change pas : rien ne saute sous les yeux.
  const previous = useRef<{ mode: HeroMode; source: HeroSource } | null>(null);
  const source = heroSourceFor(mode, inputs, { waitedOut, previous: previous.current });
  const items = useMemo(() => heroItemsFrom(source, inputs), [source, inputs]);
  if (mode && source && items.length > 0) previous.current = { mode, source };

  return { items, source, recoOf: reco.recoOf };
}
