import { useEffect, useMemo, useRef, useState } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { PLATFORMS } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";

// Les plateformes viennent de la constante partagée (familles d'ids TMDB,
// ids principaux corrigés) ; ré-exportées pour les menus de la bibliothèque.
export { PLATFORMS };

/** Le cache serveur des plateformes se remplit encore : réessayer après. */
const RETRY_MS = 5000;

interface TmdbTitle {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

interface CheckResult {
  matchingIds: number[];
  cacheReady?: boolean;
}

/** Les titres qui portent un identifiant TMDB, une fois chacun. */
function tmdbTitlesOf(items: MediaItem[], skip: Set<number>): TmdbTitle[] {
  const seen = new Set<number>();
  const out: TmdbTitle[] = [];
  for (const item of items) {
    const tmdbId = Number(item.ProviderIds?.Tmdb);
    if (!(tmdbId > 0) || skip.has(tmdbId) || seen.has(tmdbId)) continue;
    seen.add(tmdbId);
    out.push({ tmdbId, mediaType: item.Type === "Movie" ? "movie" : "tv" });
  }
  return out;
}

/**
 * Filtre par plateforme de streaming — hybride, comme le web :
 * 1. Studios Jellyfin (instantané, repli si Seer n'est pas installé) ;
 * 2. TMDB via le PROXY Tentacle (`POST /api/tmdb/check-platform`, cache
 *    serveur 24 h) — aucun appel ne sort du serveur de l'utilisateur.
 *
 * Les deux exigent les studios et l'identifiant TMDB des titres : le
 * catalogue les demande dès qu'une plateforme est choisie (`catalogParams`).
 *
 * La vérification TMDB suit les PAGES : un titre chargé après la première
 * réponse est vérifié à son tour. Elle ne se faisait qu'une fois par
 * sélection — la suite du catalogue n'était plus comparée qu'aux studios.
 */
export function usePlatformFilter(items: MediaItem[], selectedPlatformIds: number[]) {
  const { storage } = useTentacleConfig();
  const selectedKey = [...selectedPlatformIds].sort((a, b) => a - b).join(",");

  // Les titres déjà vérifiés pour CETTE sélection (une réponse complète).
  const checked = useRef<{ key: string; ids: Set<number> }>({ key: "", ids: new Set() });
  const [matching, setMatching] = useState<{ key: string; ids: Set<number> }>({ key: "", ids: new Set() });
  const [retry, setRetry] = useState(0);

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

  // Source 2 : TMDB via le backend (un appel par plateforme, cache 24 h),
  // pour les seuls titres pas encore vérifiés.
  useEffect(() => {
    if (!selectedKey || items.length === 0) return;
    if (checked.current.key !== selectedKey) checked.current = { key: selectedKey, ids: new Set() };
    const done = checked.current.ids;
    const pending = tmdbTitlesOf(items, done);
    if (pending.length === 0) return;

    const serverUrl = storage.getItem("tentacle_server_url");
    const token = storage.getItem("tentacle_token");
    if (!serverUrl || !token) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const platformIds = selectedKey.split(",").map(Number);
    Promise.all(
      platformIds.map((pid) =>
        fetch(`${serverUrl}/api/tmdb/check-platform`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tmdbIds: pending, platformId: pid }),
        }).then((r): Promise<CheckResult> => (r.ok ? r.json() : Promise.resolve({ matchingIds: [], cacheReady: false }))),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setMatching((prev) => {
          const ids = new Set(prev.key === selectedKey ? prev.ids : []);
          for (const r of results) for (const id of r.matchingIds) ids.add(id);
          return { key: selectedKey, ids };
        });
        if (results.every((r) => r.cacheReady)) {
          for (const title of pending) done.add(title.tmdbId);
        } else {
          retryTimer = setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
        }
      })
      .catch(() => { /* réseau indisponible : le match studios reste actif */ });
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [items, selectedKey, storage, retry]);

  // Combiner : studio match OU TMDB match
  const filteredItems = useMemo(() => {
    if (selectedPlatformIds.length === 0) return items;
    const tmdbMatchingIds = matching.key === selectedKey ? matching.ids : null;
    return items.filter((item) => {
      if (studioMatchedIds.has(item.Id)) return true;
      const tmdbId = Number(item.ProviderIds?.Tmdb);
      return tmdbId > 0 && tmdbMatchingIds !== null && tmdbMatchingIds.has(tmdbId);
    });
  }, [items, selectedPlatformIds, selectedKey, studioMatchedIds, matching]);

  return { filteredItems };
}
