import { useMemo, useRef } from "react";
import { useRecoPage, useRecoSettings, selectHeroSlides, type RecoRowItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useItemsByIdsState } from "../items/useItemsByIds";

const EMPTY: number[] = [];

export interface HomeRecoHero {
  /** Les titres tirés, résolus en items Jellyfin ; `undefined` tant qu'ils ne le sont pas. */
  items: MediaItem[] | undefined;
  /** La recommandation de chaque titre tiré (sa raison). */
  recoOf: ReadonlyMap<string, RecoRowItem>;
}

/**
 * Le héros en mode `reco` : un tirage de la rangée « Pour vous » de LA page
 * du filtre du compte — la même requête que les rangées reco de l'accueil et
 * que « Pour vous » (aucune lecture en plus), le même tirage que le web et le
 * mobile (`selectHeroSlides`, une graine par montage). Le téléviseur ne tire
 * que parmi les titres EN bibliothèque : rien à demander à trois mètres.
 */
export function useHomeRecoHero(enabled: boolean): HomeRecoHero {
  const settings = useRecoSettings();
  // Le filtre du compte d'abord (cf. `useHomeRecoSource`) : la page non filtrée ne part jamais avant.
  const settingsReady = settings.isSuccess || settings.isError;
  const page = useRecoPage(settings.data?.providerFilter ?? EMPTY, { enabled: enabled && settingsReady });
  const seed = useRef(Math.random());
  const drawn = useMemo(() => {
    const forYou = page.data?.rows.find((row) => row.key === "forYou")?.items ?? [];
    return selectHeroSlides(forYou.filter((item) => item.jellyfinItemId !== null), seed.current);
  }, [page.data]);
  const ids = useMemo(() => drawn.map((reco) => reco.jellyfinItemId as string), [drawn]);
  const { items, settled } = useItemsByIdsState(ids);

  return useMemo(() => {
    const recoOf = new Map(drawn.map((reco) => [reco.jellyfinItemId as string, reco]));
    if (!enabled) return { items: undefined, recoOf };
    if (page.isError) return { items: [], recoOf };
    if (!page.data || !settled) return { items: undefined, recoOf };
    return { items: ids.flatMap((id) => items.get(id) ?? []), recoOf };
  }, [enabled, page.isError, page.data, settled, drawn, ids, items]);
}
