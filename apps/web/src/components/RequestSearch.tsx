import { useState, useEffect } from "react";
import { useSeerrSearch, useSeerrDiscover, useRequestMedia } from "@tentacle/api-client";
import type { SeerrSearchResult } from "@tentacle/api-client";
import { SeerrCard } from "./SeerrCard";

/**
 * Search + discover tab for requesting new media.
 * Shows trending content by default, search results when typing.
 */
export function RequestSearch() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 400);
    return () => clearTimeout(t);
  }, [input]);

  const { data: searchData, isLoading: searchLoading } = useSeerrSearch(debounced);
  const { data: trendingMovies } = useSeerrDiscover("movies");
  const { data: trendingTv } = useSeerrDiscover("tv");
  const requestMut = useRequestMedia();

  const searchResults = (searchData?.results ?? []).filter(
    (r) => r.mediaType === "movie" || r.mediaType === "tv"
  );

  const isSearching = debounced.length >= 2;

  const handleRequest = (item: SeerrSearchResult) => {
    requestMut.mutate({
      mediaType: item.mediaType as "movie" | "tv",
      tmdbId: item.id,
      title: item.title || item.name || `#${item.id}`,
      posterPath: item.posterPath,
    });
  };

  return (
    <div>
      {/* Search bar */}
      <div className="mb-6 px-12">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Rechercher un film ou une série..."
          className="w-full max-w-lg rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
          autoFocus
        />
      </div>

      <div className="px-12">
        {requestMut.isSuccess && (
          <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">
            Demande ajoutée à la file d'attente
          </div>
        )}

        {/* Search results */}
        {isSearching && searchLoading && <Spinner />}

        {isSearching && !searchLoading && searchResults.length === 0 && (
          <p className="py-20 text-center text-white/40">Aucun résultat</p>
        )}

        {isSearching && searchResults.length > 0 && (
          <MediaGrid items={searchResults} onRequest={handleRequest} />
        )}

        {/* Default: trending content */}
        {!isSearching && (
          <div className="space-y-8">
            <TrendingSection
              title="Films tendances"
              items={trendingMovies?.results}
              onRequest={handleRequest}
            />
            <TrendingSection
              title="Séries tendances"
              items={trendingTv?.results}
              onRequest={handleRequest}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TrendingSection({ title, items, onRequest }: {
  title: string;
  items: SeerrSearchResult[] | undefined;
  onRequest: (item: SeerrSearchResult) => void;
}) {
  const filtered = (items ?? []).filter(
    (r) => r.mediaType === "movie" || r.mediaType === "tv"
  ).slice(0, 24);

  if (filtered.length === 0) return null;

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      <MediaGrid items={filtered} onRequest={onRequest} />
    </div>
  );
}

function MediaGrid({ items, onRequest }: {
  items: SeerrSearchResult[];
  onRequest: (item: SeerrSearchResult) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <SeerrCard
          key={`${item.mediaType}-${item.id}`}
          item={item}
          onRequest={() => onRequest(item)}
        />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
    </div>
  );
}
