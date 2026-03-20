import { useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MediaItem } from "@tentacle-tv/shared";
import { PLATFORMS } from "@/components/catalog/PlatformFilter";

async function getBackendUrl(): Promise<string> {
  return (await AsyncStorage.getItem("tentacle_server_url")) ?? "";
}

async function getToken(): Promise<string> {
  return (await AsyncStorage.getItem("tentacle_token")) ?? "";
}

export function usePlatformFilter(items: MediaItem[], selectedPlatformIds: number[]) {
  const [tmdbMatchingIds, setTmdbMatchingIds] = useState<Set<number>>(new Set());
  const [, setTmdbLoading] = useState(false);
  const [lastCheckedKey, setLastCheckedKey] = useState("");

  const selectedKey = [...selectedPlatformIds].sort().join(",");

  // Source 1 : Studio match (instantané)
  const studioMatchedIds = useMemo(() => {
    if (selectedPlatformIds.length === 0) return new Set<string>();
    const matched = new Set<string>();
    const allNames = selectedPlatformIds.flatMap((pid) => {
      const p = PLATFORMS.find((pl) => pl.id === pid);
      return p ? p.studioNames.map((s: string) => s.toLowerCase()) : [];
    });
    for (const item of items) {
      const studios = item.Studios?.map((s) => s.Name?.toLowerCase()) ?? [];
      if (studios.some((s) => allNames.some((n: string) => s?.includes(n)))) {
        matched.add(item.Id);
      }
    }
    return matched;
  }, [items, selectedPlatformIds]);

  // Source 2 : TMDB discover (parallèle par plateforme)
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

    setTmdbLoading(true);
    (async () => {
      try {
        const [backendUrl, token] = await Promise.all([getBackendUrl(), getToken()]);
        if (!backendUrl) return;
        const results = await Promise.all(
          selectedPlatformIds.map((pid) =>
            fetch(`${backendUrl}/api/tmdb/check-platform`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ tmdbIds: tmdbItems, platformId: pid }),
            })
              .then((r) => (r.ok ? r.json() : { matchingIds: [], cacheReady: false }))
              .then((d: { matchingIds: number[]; cacheReady?: boolean }) => d),
          ),
        );
        const allIds = new Set<number>();
        let allReady = true;
        for (const r of results) {
          for (const id of r.matchingIds) allIds.add(id);
          if (!r.cacheReady) allReady = false;
        }
        setTmdbMatchingIds(allIds);
        if (allReady) setLastCheckedKey(selectedKey);
        else setTimeout(() => setLastCheckedKey(""), 5000);
      } catch {}
      finally { setTmdbLoading(false); }
    })();
  }, [items, selectedPlatformIds, selectedKey, lastCheckedKey]);

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
