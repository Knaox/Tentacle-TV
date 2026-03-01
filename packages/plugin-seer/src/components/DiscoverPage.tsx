import { useState, useCallback, useRef, useEffect } from "react";
import { useDiscoverMedia } from "../hooks/useDiscoverMedia";
import { useSeerSearch } from "../hooks/useSearch";
import { useRequestMedia } from "../hooks/useRequestMedia";
import { MediaCard } from "./MediaCard";
import { MediaTypeFilter } from "./MediaTypeFilter";
import { SortSelector } from "./SortSelector";
import { MediaDetailModal } from "./MediaDetailModal";
import type { SeerrSearchResult, DiscoverCategory, MediaFilter, SortOption } from "../api/types";

export function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [sort, setSort] = useState<SortOption>("popularity");
  const [page, setPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<SeerrSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const category: DiscoverCategory = mediaFilter === "movie"
    ? "movies"
    : mediaFilter === "tv"
      ? "tv"
      : mediaFilter === "anime"
        ? "anime"
        : sort === "trending"
          ? "trending"
          : "movies";

  const { data: discoverData, isLoading: discoverLoading } = useDiscoverMedia(category, page);
  const { data: searchData, isLoading: searchLoading } = useSeerSearch(debouncedQuery, page);
  const requestMedia = useRequestMedia();

  const isSearching = debouncedQuery.length >= 2;
  const results = isSearching ? searchData?.results : discoverData?.results;
  const totalPages = isSearching ? searchData?.totalPages : discoverData?.totalPages;
  const isLoading = isSearching ? searchLoading : discoverLoading;

  // Filter results by media type
  const filtered = results?.filter((item) => {
    if (item.mediaType === "person") return false;
    if (mediaFilter === "movie") return item.mediaType === "movie";
    if (mediaFilter === "tv") return item.mediaType === "tv";
    if (mediaFilter === "anime") {
      return item.genreIds?.includes(16) && item.originCountry?.includes("JP");
    }
    return true;
  });

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleRequest = useCallback((item: SeerrSearchResult) => {
    if (item.mediaType === "movie") {
      requestMedia.mutate({
        mediaType: "movie",
        tmdbId: item.id,
        title: item.title ?? item.name ?? "",
        posterPath: item.posterPath ?? undefined,
      });
    }
  }, [requestMedia]);

  return (
    <div className="px-4 pt-4 md:px-12">
      <h1 className="mb-6 text-2xl font-bold text-white">Decouvrir</h1>

      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un film, une serie..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-purple-500 focus:bg-white/8"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <MediaTypeFilter value={mediaFilter} onChange={(v) => { setMediaFilter(v); setPage(1); }} />
        {!isSearching && (
          <SortSelector value={sort} onChange={(v) => { setSort(v); setPage(1); }} />
        )}
      </div>

      {/* Results grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      ) : filtered && filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((item) => (
              <MediaCard
                key={`${item.mediaType}-${item.id}`}
                item={item}
                onRequest={handleRequest}
                onClick={setSelectedItem}
                requesting={requestMedia.isPending}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 pb-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 disabled:opacity-30"
              >
                Precedent
              </button>
              <span className="text-sm text-white/40">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 disabled:opacity-30"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="py-12 text-center text-sm text-white/30">
          {isSearching ? "Aucun resultat" : "Aucun contenu disponible"}
        </div>
      )}

      {/* Detail modal */}
      {selectedItem && (
        <MediaDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRequest={handleRequest}
          requesting={requestMedia.isPending}
        />
      )}
    </div>
  );
}
