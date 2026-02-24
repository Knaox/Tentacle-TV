import { useState } from "react";
import { useSeerrDiscover, useRequestMedia } from "@tentacle/api-client";
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
  const { data, isLoading } = useSeerrDiscover(category, page);
  const requestMutation = useRequestMedia();

  const results = (data?.results ?? []).filter((r) => r.mediaType === "movie" || r.mediaType === "tv");

  const handleRequest = (body: { mediaType: "movie" | "tv"; mediaId: number }) => {
    const item = results.find((r) => r.id === body.mediaId && r.mediaType === body.mediaType);
    requestMutation.mutate({
      mediaType: body.mediaType,
      tmdbId: body.mediaId,
      title: item?.title || item?.name || "Unknown",
      posterPath: item?.posterPath,
    });
  };
  const totalPages = data?.totalPages ?? 1;

  return (
    <div>
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

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((item) => (
            <SeerrCard key={`${item.mediaType}-${item.id}`} item={item} onRequest={handleRequest} />
          ))}
        </div>
      )}

      {!isLoading && results.length === 0 && (
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
          <span className="text-sm text-white/50">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/20 disabled:opacity-30"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
