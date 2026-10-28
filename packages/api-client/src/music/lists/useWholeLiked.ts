/**
 * Octave — « Titres likés » ENTIERS quand on peut les trier : pages de 500
 * enchaînées dès l'ouverture (1 000 titres = 2 requêtes), dans l'ordre de la
 * préférence du compte — chaque page prolonge la liste affichée, rien ne
 * s'insère au-dessus. Sans `music.listOrder` : pages de 100 à l'approche du bas,
 * comme avant.
 */

import { useEffect, useMemo } from "react";
import { useMusicLiked } from "../useMusicFavorite";
import { useMusicListOrderCapability } from "../useMusicListOrder";
import type { MusicListStats } from "@tentacle-tv/shared/music";

const WHOLE_PAGE = 500;

export function useWholeLiked() {
  const sortable = useMusicListOrderCapability();
  const liked = useMusicLiked(sortable ? { limit: WHOLE_PAGE } : {});
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = liked;
  useEffect(() => {
    if (sortable && hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isError, isFetchingNextPage, sortable]);
  const stats = useMemo(() => {
    const map = new Map<string, MusicListStats>();
    for (const page of liked.data?.pages ?? []) for (const [id, s] of Object.entries(page.stats ?? {})) map.set(id, s);
    return map;
  }, [liked.data]);
  return { liked, sortable, stats, complete: !hasNextPage };
}
