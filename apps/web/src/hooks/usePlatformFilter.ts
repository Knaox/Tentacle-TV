import { useState, useEffect, useMemo } from "react";
import { PLATFORMS } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { getBackendBase } from "../lib/backendBase";

// Les plateformes viennent de la constante partagée (familles d'ids TMDB,
// ids principaux corrigés : OCS 685, Arte 234) ; ré-exportées pour les
// importeurs historiques (menus et pastilles de la bibliothèque).
export { PLATFORMS } from "@tentacle-tv/shared";

function getToken(): string {
  return localStorage.getItem("tentacle_token") ?? "";
}

/**
 * Filtre hybride :
 * 1. Studios Jellyfin (instantané, fallback si Seer pas installé)
 * 2. TMDB discover via Seerr (même source que le plugin Seer — précis)
 */
export function usePlatformFilter(items: MediaItem[], selectedPlatformIds: number[]) {
  const [tmdbMatchingIds, setTmdbMatchingIds] = useState<Set<number>>(new Set());
  const [, setTmdbLoading] = useState(false);
  const [lastCheckedKey, setLastCheckedKey] = useState("");

  const selectedKey = selectedPlatformIds.sort().join(",");

  // Source 1 : Studio match (instantané) — pour toutes les plateformes sélectionnées
  const studioMatchedIds = useMemo(() => {
    if (selectedPlatformIds.length === 0) return new Set<string>();
    const matched = new Set<string>();
    const allStudioNames = selectedPlatformIds.flatMap((pid) => {
      const p = PLATFORMS.find((pl) => pl.id === pid);
      return p ? p.studioNames.map((s) => s.toLowerCase()) : [];
    });
    for (const item of items) {
      const studios = item.Studios?.map((s) => s.Name?.toLowerCase()) ?? [];
      if (studios.some((s) => allStudioNames.some((n) => s?.includes(n)))) {
        matched.add(item.Id);
      }
    }
    return matched;
  }, [items, selectedPlatformIds]);

  // Source 2 : TMDB discover via backend (appel unique par plateforme, cached 24h côté serveur)
  useEffect(() => {
    if (selectedPlatformIds.length === 0 || items.length === 0) return;
    if (lastCheckedKey === selectedKey) return;

    const tmdbItems = items
      .filter((item) => Number(item.ProviderIds?.Tmdb) > 0)
      .map((item) => ({
        tmdbId: Number(item.ProviderIds!.Tmdb),
        mediaType: (item.Type === "Movie" ? "movie" : "tv") as "movie" | "tv",
      }));

    if (tmdbItems.length === 0) return;

    // Lancer un check par plateforme sélectionnée en parallèle
    setTmdbLoading(true);
    Promise.all(
      selectedPlatformIds.map((pid) =>
        fetch(`${getBackendBase()}/api/tmdb/check-platform`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ tmdbIds: tmdbItems, platformId: pid }),
        })
          .then((r) => (r.ok ? r.json() : { matchingIds: [], cacheReady: false }))
          .then((d: { matchingIds: number[]; cacheReady?: boolean }) => d),
      ),
    )
      .then((results) => {
        const allIds = new Set<number>();
        let allReady = true;
        for (const r of results) {
          for (const id of r.matchingIds) allIds.add(id);
          if (!r.cacheReady) allReady = false;
        }
        setTmdbMatchingIds(allIds);
        if (allReady) {
          setLastCheckedKey(selectedKey);
        } else {
          setTimeout(() => setLastCheckedKey(""), 5000);
        }
      })
      .catch((err) => console.warn("[PlatformFilter]", err))
      .finally(() => setTmdbLoading(false));
  }, [items, selectedPlatformIds, selectedKey, lastCheckedKey]);

  // Combiner : studio match OU TMDB discover match
  const filteredItems = useMemo(() => {
    if (selectedPlatformIds.length === 0) return items;
    return items.filter((item) => {
      if (studioMatchedIds.has(item.Id)) return true;
      const tmdbId = Number(item.ProviderIds?.Tmdb);
      if (tmdbId > 0 && tmdbMatchingIds.has(tmdbId)) return true;
      return false;
    });
  }, [items, selectedPlatformIds, studioMatchedIds, tmdbMatchingIds]);

  return { filteredItems, loading: false };
}
