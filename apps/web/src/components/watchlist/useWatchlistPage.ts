import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  filterByWatchStage,
  parseWatchStageFilter,
  resumeQueue,
  summarizeWatchlist,
  type WatchStageFilter,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useCollectionFilters } from "../collection/useCollectionFilters";
import { useWatchlistView } from "./useWatchlistView";

export type { WatchlistView } from "./useWatchlistView";

/**
 * Tout l'état de la page Ma liste, dérivé en mémoire de la liste chargée.
 *
 * L'étape (`?progress=`) rejoint l'adresse comme les filtres de la
 * bibliothèque : revenir d'une fiche la retrouve. Elle s'applique APRÈS les
 * autres filtres, et ses comptes sont pris sur ce que ces filtres gardent —
 * une pastille « En cours · 3 » doit donner trois titres au clic.
 *
 * L'affichage grille / liste est une préférence de l'appareil, pas un état de
 * navigation : il vit dans le stockage local.
 */
export function useWatchlistPage(items: MediaItem[] | undefined) {
  const filters = useCollectionFilters(items);
  const [searchParams, setSearchParams] = useSearchParams();
  const stage = parseWatchStageFilter(searchParams.get("progress"));

  const setStage = useCallback(
    (next: WatchStageFilter) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "all") p.delete("progress");
          else p.set("progress", next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { view, setView } = useWatchlistView();

  const stageCounts = useMemo(() => summarizeWatchlist(filters.filtered), [filters.filtered]);
  const summary = useMemo(() => summarizeWatchlist(items ?? []), [items]);
  const visible = useMemo(() => filterByWatchStage(filters.filtered, stage), [filters.filtered, stage]);
  const resume = useMemo(() => resumeQueue(items ?? []), [items]);

  return {
    filters,
    stage,
    setStage,
    view,
    setView,
    /** Comptes par étape, sous les filtres courants. */
    stageCounts,
    /** Comptes de la liste entière — le résumé de la bannière. */
    summary,
    visible,
    resume,
  };
}

export type WatchlistPageState = ReturnType<typeof useWatchlistPage>;
