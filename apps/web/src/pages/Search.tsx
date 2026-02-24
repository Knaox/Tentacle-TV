import { useState, useMemo, useCallback } from "react";
import { useSeerrSearch, useSeerrRequest } from "@tentacle/api-client";
import type { SeerrSearchResult } from "@tentacle/api-client";
import { Navbar } from "../components/Navbar";

const TMDB_IMG = "https://image.tmdb.org/t/p";

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  2: { label: "Demandé", color: "bg-yellow-500/20 text-yellow-400" },
  3: { label: "En cours", color: "bg-blue-500/20 text-blue-400" },
  4: { label: "Partiel", color: "bg-orange-500/20 text-orange-400" },
  5: { label: "Disponible", color: "bg-green-500/20 text-green-400" },
};

export function Search() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useSeerrSearch(query);
  const requestMutation = useSeerrRequest();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setQuery(input.trim());
  }, [input]);

  const results = useMemo(() =>
    (data?.results ?? []).filter((r) => r.mediaType === "movie" || r.mediaType === "tv"),
    [data],
  );

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />

      <div className="px-12 pt-24 pb-16">
        <h1 className="mb-6 text-3xl font-bold text-white">Rechercher</h1>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="mb-8 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Film, série, anime..."
            className="flex-1 rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-tentacle-accent"
            autoFocus
          />
          <button
            type="submit"
            className="rounded-xl bg-tentacle-accent px-6 py-3 font-semibold text-white transition-transform hover:scale-105"
          >
            Rechercher
          </button>
        </form>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
          </div>
        )}

        {/* Results grid */}
        {!isLoading && results.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((item) => (
              <SearchCard key={`${item.mediaType}-${item.id}`} item={item} onRequest={requestMutation.mutate} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && query && results.length === 0 && (
          <p className="py-20 text-center text-white/40">Aucun résultat pour « {query} »</p>
        )}
      </div>
    </div>
  );
}

function SearchCard({ item, onRequest }: { item: SeerrSearchResult; onRequest: (body: { mediaType: "movie" | "tv"; mediaId: number }) => void }) {
  const title = item.title || item.name || "";
  const year = (item.releaseDate || item.firstAirDate || "").slice(0, 4);
  const poster = item.posterPath ? `${TMDB_IMG}/w300${item.posterPath}` : null;
  const status = item.mediaInfo?.status;
  const statusInfo = status ? STATUS_LABELS[status] : null;
  const isAvailable = status === 5;
  const isRequested = status != null && status >= 2;

  const handleRequest = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRequested) return;
    onRequest({ mediaType: item.mediaType as "movie" | "tv", mediaId: item.id });
  };

  return (
    <div className="group relative overflow-hidden rounded-xl bg-tentacle-surface">
      {/* Poster */}
      <div className="aspect-[2/3] w-full bg-tentacle-surface">
        {poster ? (
          <img src={poster} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/20">{title}</div>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="p-3">
          <p className="text-sm font-semibold text-white line-clamp-2">{title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
            {year && <span>{year}</span>}
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
              {item.mediaType === "movie" ? "Film" : "Série"}
            </span>
            {item.voteAverage != null && item.voteAverage > 0 && <span>{item.voteAverage.toFixed(1)}</span>}
          </div>

          {/* Status badge or request button */}
          {statusInfo ? (
            <span className={`mt-2 inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          ) : (
            <button
              onClick={handleRequest}
              className="mt-2 rounded-lg bg-tentacle-accent px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105"
            >
              Demander
            </button>
          )}
        </div>
      </div>

      {/* Always-visible status badge */}
      {isAvailable && (
        <div className="absolute right-2 top-2 rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-medium text-white">
          Disponible
        </div>
      )}
    </div>
  );
}
