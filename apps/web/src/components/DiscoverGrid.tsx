import { useState, useEffect } from "react";
import { useSeerrDiscover, useSeerrSearch, useRequestMedia } from "@tentacle/api-client";
import { SeerrCard } from "./SeerrCard";

type Category = "movies" | "tv" | "anime";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "movies", label: "Films" },
  { key: "tv", label: "Séries" },
  { key: "anime", label: "Animés" },
];

export function DiscoverGrid() {
  const [category, setCategory] = useState<Category>("movies");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isSearching = searchDebounced.length >= 2;
  const { data: searchData, isLoading: searchLoading } = useSeerrSearch(searchDebounced);
  const { data, isLoading } = useSeerrDiscover(category, page);
  const requestMutation = useRequestMedia();

  const searchResults = (searchData?.results ?? []).filter(
    (r) => r.mediaType === "movie" || r.mediaType === "tv"
  );
  const discoverResults = (data?.results ?? []).filter(
    (r) => r.mediaType === "movie" || r.mediaType === "tv"
  );
  const totalPages = data?.totalPages ?? 1;

  const handleRequest = (body: { mediaType: "movie" | "tv"; mediaId: number }) => {
    const pool = isSearching ? searchResults : discoverResults;
    const item = pool.find((r) => r.id === body.mediaId && r.mediaType === body.mediaType);
    setFeedback(null);
    requestMutation.mutate(
      {
        mediaType: body.mediaType,
        tmdbId: body.mediaId,
        title: item?.title || item?.name || "Unknown",
        posterPath: item?.posterPath,
      },
      {
        onSuccess: () => setFeedback({ type: "success", msg: "Demande ajoutée à la file d'attente" }),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          setFeedback({ type: "error", msg: `Erreur : ${msg}` });
        },
      }
    );
  };

  return (
    <div>
      {/* Search bar */}
      <div className="mb-5">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher un film ou une série à demander..."
          className="w-full max-w-lg rounded-xl bg-white/5 px-5 py-3 text-white placeholder-white/30 outline-none ring-1 ring-white/10 transition-all focus:ring-purple-500/50"
        />
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
          feedback.type === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Search results */}
      {isSearching && (
        <>
          {searchLoading && <Spinner />}
          {!searchLoading && searchResults.length === 0 && (
            <p className="py-20 text-center text-white/40">Aucun résultat pour « {searchDebounced} »</p>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {searchResults.map((item) => (
                <SeerrCard key={`${item.mediaType}-${item.id}`} item={item} onRequest={handleRequest} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Discover content (when not searching) */}
      {!isSearching && (
        <>
          {/* Sub-category tabs */}
          <div className="mb-6 flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => { setCategory(cat.key); setPage(1); }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  category === cat.key
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {isLoading && <Spinner />}

          {!isLoading && discoverResults.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {discoverResults.map((item) => (
                <SeerrCard key={`${item.mediaType}-${item.id}`} item={item} onRequest={handleRequest} />
              ))}
            </div>
          )}

          {!isLoading && discoverResults.length === 0 && (
            <p className="py-20 text-center text-white/40">Aucun contenu à découvrir</p>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/20 disabled:opacity-30"
              >
                Précédent
              </button>
              <span className="text-sm text-white/50">Page {page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/20 disabled:opacity-30"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
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
