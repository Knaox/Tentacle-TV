import { useEffect, useMemo, useState } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { PLATFORMS } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";

// Les plateformes viennent de la constante partagée (familles d'ids TMDB,
// ids principaux corrigés) ; ré-exportées pour les menus de la bibliothèque.
export { PLATFORMS };

/**
 * Filtre par plateforme de streaming — hybride, comme le web :
 * 1. Studios Jellyfin (instantané, repli si Seer n'est pas installé) ;
 * 2. TMDB via le PROXY Tentacle (`POST /api/tmdb/check-platform`, cache
 *    serveur 24 h) — aucun appel ne sort du serveur de l'utilisateur.
 */
export function usePlatformFilter(items: MediaItem[], selectedPlatformIds: number[]) {
  const { storage } = useTentacleConfig();
  const [tmdbMatchingIds, setTmdbMatchingIds] = useState<Set<number>>(new Set());
  const [lastCheckedKey, setLastCheckedKey] = useState("");

  const selectedKey = [...selectedPlatformIds].sort((a, b) => a - b).join(",");

  // Source 1 : Studio match (instantané)
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

  // Source 2 : TMDB via le backend (un appel par plateforme, cache 24 h)
  useEffect(() => {
    if (selectedPlatformIds.length === 0 || items.length === 0) return;
    if (lastCheckedKey === selectedKey) return;

    const serverUrl = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");
    if (!serverUrl || !token) return;

    const tmdbItems = items
      .filter((item) => Number(item.ProviderIds?.Tmdb) > 0)
      .map((item) => ({
        tmdbId: Number(item.ProviderIds!.Tmdb),
        mediaType: (item.Type === "Movie" ? "movie" : "tv") as "movie" | "tv",
      }));

    if (tmdbItems.length === 0) return;

    let cancelled = false;
    Promise.all(
      selectedPlatformIds.map((pid) =>
        fetch(`${serverUrl}/api/tmdb/check-platform`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tmdbIds: tmdbItems, platformId: pid }),
        })
          .then((r) => (r.ok ? r.json() : { matchingIds: [], cacheReady: false }))
          .then((d: { matchingIds: number[]; cacheReady?: boolean }) => d),
      ),
    )
      .then((results) => {
        if (cancelled) return;
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
          // Le cache serveur se remplit encore : re-tenter dans 5 s.
          setTimeout(() => { if (!cancelled) setLastCheckedKey(""); }, 5000);
        }
      })
      .catch(() => { /* réseau indisponible : le match studios reste actif */ });
    return () => { cancelled = true; };
  }, [items, selectedPlatformIds, selectedKey, lastCheckedKey, storage]);

  // Combiner : studio match OU TMDB match
  const filteredItems = useMemo(() => {
    if (selectedPlatformIds.length === 0) return items;
    return items.filter((item) => {
      if (studioMatchedIds.has(item.Id)) return true;
      const tmdbId = Number(item.ProviderIds?.Tmdb);
      return tmdbId > 0 && tmdbMatchingIds.has(tmdbId);
    });
  }, [items, selectedPlatformIds, studioMatchedIds, tmdbMatchingIds]);

  return { filteredItems };
}
