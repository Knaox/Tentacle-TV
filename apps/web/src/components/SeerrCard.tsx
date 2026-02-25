import type { SeerrSearchResult } from "@tentacle/api-client";

const TMDB_IMG = "https://image.tmdb.org/t/p";

export const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  2: { label: "Demandé", color: "bg-yellow-500/20 text-yellow-400" },
  3: { label: "En cours", color: "bg-blue-500/20 text-blue-400" },
  4: { label: "Partiel", color: "bg-orange-500/20 text-orange-400" },
  5: { label: "Disponible", color: "bg-green-500/20 text-green-400" },
};

interface SeerrCardProps {
  item: SeerrSearchResult;
  onRequest: (body: { mediaType: "movie" | "tv"; mediaId: number }) => void;
  onWatch?: (title: string) => void;
}

export function SeerrCard({ item, onRequest, onWatch }: SeerrCardProps) {
  const title = item.title || item.name || "";
  const year = (item.releaseDate || item.firstAirDate || "").slice(0, 4);
  const poster = item.posterPath ? `${TMDB_IMG}/w300${item.posterPath}` : null;
  const status = item.mediaInfo?.status;
  const statusInfo = status ? STATUS_LABELS[status] : null;
  const isRequested = status != null && status >= 2;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-tentacle-surface">
      <div className="aspect-[2/3] bg-tentacle-surface">
        {poster ? (
          <img src={poster} alt={title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/20">{title}</div>
        )}
      </div>
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="p-3">
          <p className="text-sm font-semibold text-white line-clamp-2">{title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
            {year && <span>{year}</span>}
            <span className="rounded bg-white/10 px-1.5 py-0.5">
              {item.mediaType === "movie" ? "Film" : "Série"}
            </span>
          </div>
          {status === 5 ? (
            <button
              onClick={(e) => { e.stopPropagation(); onWatch?.(title); }}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Regarder
            </button>
          ) : statusInfo ? (
            <span className={`mt-2 inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isRequested) onRequest({ mediaType: item.mediaType as "movie" | "tv", mediaId: item.id });
              }}
              className="mt-2 rounded-lg bg-tentacle-accent px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105"
            >
              Demander
            </button>
          )}
        </div>
      </div>
      {status === 5 && (
        <div className="absolute right-2 top-2 rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-medium text-white">
          Disponible
        </div>
      )}
    </div>
  );
}
