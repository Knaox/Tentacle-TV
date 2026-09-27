import { useCallback, useMemo, useState } from "react";
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

export type WatchlistView = "grid" | "list";

/**
 * Clé NOUVELLE, propre à cette page — elle ne se renomme pas (cf. CLAUDE.md,
 * « un nom traversé par une chaîne n'est pas un identifiant »).
 */
const VIEW_STORAGE_KEY = "tentacle_watchlist_view";

function readStoredView(): WatchlistView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

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

  const [view, setViewState] = useState<WatchlistView>(readStoredView);
  const setView = useCallback((next: WatchlistView) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Stockage refusé (navigation privée) : le choix vaut pour la visite.
    }
  }, []);

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
