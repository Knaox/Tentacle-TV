import { useState, useEffect } from "react";
import { useSeerrSearch, useRequestMedia } from "@tentacle/api-client";
import type { SeerrSearchResult } from "@tentacle/api-client";
import { SeerrCard } from "./SeerrCard";

/**
 * Search tab for requesting new media.
 * Searches via Seerr but submits requests through the Tentacle worker queue.
 */
export function RequestSearch() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading } = useSeerrSearch(debounced);
  const requestMut = useRequestMedia();

  const results = (data?.results ?? []).filter(
    (r) => r.mediaType === "movie" || r.mediaType === "tv"
  );

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
          placeholder="Rechercher un film ou une série à demander..."
          className="w-full max-w-md rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
          autoFocus
        />
      </div>

      <div className="px-12">
        {requestMut.isSuccess && (
          <div className="mb-4 rounded-lg bg-green-500/10 px-4 py-2 text-sm text-green-400">
            Demande ajoutée à la file d'attente
          </div>
        )}

        {isLoading && debounced.length >= 2 && <Spinner />}

        {!isLoading && debounced.length >= 2 && results.length === 0 && (
          <p className="py-20 text-center text-white/40">Aucun résultat</p>
        )}

        {!isLoading && debounced.length < 2 && (
          <p className="py-20 text-center text-white/40">
            Recherchez un film ou une série pour faire une demande
          </p>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((item) => (
              <SeerrCard
                key={`${item.mediaType}-${item.id}`}
                item={item}
                onRequest={() => handleRequest(item)}
              />
            ))}
          </div>
        )}
      </div>
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
