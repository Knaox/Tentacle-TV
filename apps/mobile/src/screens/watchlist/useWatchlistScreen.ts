import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  filterByWatchStage,
  resumeQueue,
  summarizeWatchlist,
  useResolvePlayTarget,
  useTentacleConfig,
  type WatchStageFilter,
  type WatchlistSummary,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useCollectionFilters } from "../collection/useCollectionFilters";

export type WatchlistView = "grid" | "list";

/**
 * Clé NOUVELLE, propre à Ma liste — elle ne se renomme pas (CLAUDE.md : « un
 * nom traversé par une chaîne n'est pas un identifiant »). Même clé que le web.
 */
const VIEW_KEY = "tentacle_watchlist_view";

/**
 * L'état de l'écran Ma liste, tiré en mémoire de la liste chargée : filtres de
 * collection (ceux de Mes favoris, au mot près), étape de visionnage PAR-
 * DESSUS, affichage grille / liste retenu sur l'appareil, file « Reprendre ».
 */
export function useWatchlistScreen(items: MediaItem[] | undefined) {
  const { storage } = useTentacleConfig();
  const filters = useCollectionFilters(items);
  const [stage, setStage] = useState<WatchStageFilter>("all");
  const [view, setViewState] = useState<WatchlistView>(() => {
    try {
      return storage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const setView = useCallback(
    (next: WatchlistView) => {
      setViewState(next);
      try {
        storage.setItem(VIEW_KEY, next);
      } catch {
        // Stockage indisponible : le choix vaut pour la visite.
      }
    },
    [storage],
  );

  const stageCounts = useMemo(() => summarizeWatchlist(filters.filtered), [filters.filtered]);
  const summary = useMemo(() => summarizeWatchlist(items ?? []), [items]);
  const visible = useMemo(() => filterByWatchStage(filters.filtered, stage), [filters.filtered, stage]);
  const resume = useMemo(() => resumeQueue(items ?? []), [items]);

  return { filters, stage, setStage, view, setView, stageCounts, summary, visible, resume };
}

/** « 29 titres · 8 en cours · 5 terminés » — les étapes vides se taisent. */
export function useSummaryLine(summary: WatchlistSummary): string {
  const { t } = useTranslation("watchlist");
  return useMemo(
    () =>
      [
        t("statTotal", { count: summary.total }),
        summary.inProgress > 0 ? t("statInProgress", { count: summary.inProgress }) : null,
        summary.watched > 0 ? t("statWatched", { count: summary.watched }) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    [summary, t],
  );
}

/**
 * « Lire » depuis Ma liste : un film part tout de suite, une série résout son
 * épisode au geste. Sans rien à lire, la fiche s'ouvre.
 */
export function usePlayFromWatchlist() {
  const router = useRouter();
  const resolve = useResolvePlayTarget();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const play = useCallback(
    async (item: MediaItem) => {
      setPendingId(item.Id);
      try {
        const target = await resolve(item);
        router.push(target ? `/watch/${target}` : `/media/${item.Id}`);
      } finally {
        setPendingId(null);
      }
    },
    [resolve, router],
  );
  return { play, pendingId };
}
