import { useRef } from "react";
import { useMediaItem } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * L'art des titres du héros, chargé d'avance : la fiche de chacun (la série
 * pour un épisode), par `useMediaItem` — le cache même de la page de détail,
 * que les gestes de Ma liste patchent. La rotation trouve ainsi chaque logo et
 * chaque fond prêts à leur tour, au lieu d'écrire le titre en lettres puis de
 * le remplacer par son logo sous les yeux.
 *
 * Cinq au plus, comme le héros : cinq appels fixes, un par place.
 */

export const HERO_MAX_ITEMS = 5;

export const artIdOf = (item: MediaItem | null | undefined): string | undefined =>
  item?.Type === "Episode" && item.SeriesId ? item.SeriesId : item?.Id;

export interface HeroArts {
  /** L'art chargé du titre, ou rien. */
  artOf: (item: MediaItem) => MediaItem | undefined;
  /** Son chargement est fini — réussi ou non. */
  settled: (item: MediaItem) => boolean;
}

export function useHeroArts(items: readonly MediaItem[]): HeroArts {
  const ids = items.slice(0, HERO_MAX_ITEMS).map(artIdOf);
  const q0 = useMediaItem(ids[0]);
  const q1 = useMediaItem(ids[1]);
  const q2 = useMediaItem(ids[2]);
  const q3 = useMediaItem(ids[3]);
  const q4 = useMediaItem(ids[4]);
  const queries = [q0, q1, q2, q3, q4];

  // Les requêtes rendent un objet neuf à chaque rendu : l'index ne se refait
  // que quand une place change d'identifiant, de données ou d'échec.
  const signature = ids
    .map((id, i) => `${id ?? ""}:${queries[i].dataUpdatedAt}:${queries[i].isError ? 1 : 0}`)
    .join("|");
  const cache = useRef<{ signature: string; arts: HeroArts } | null>(null);
  if (cache.current?.signature !== signature) {
    const byId = new Map<string, MediaItem>();
    const failed = new Set<string>();
    ids.forEach((id, i) => {
      if (!id) return;
      const data = queries[i].data;
      if (data && data.Id === id) byId.set(id, data);
      else if (queries[i].isError) failed.add(id);
    });
    cache.current = {
      signature,
      arts: {
        artOf: (item) => {
          const id = artIdOf(item);
          return id ? byId.get(id) : undefined;
        },
        settled: (item) => {
          const id = artIdOf(item);
          return !id || byId.has(id) || failed.has(id);
        },
      },
    };
  }
  return cache.current.arts;
}
