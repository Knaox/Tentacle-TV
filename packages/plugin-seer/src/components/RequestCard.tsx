import type { LocalMediaRequest } from "../api/types";
import { posterUrl } from "../utils/media-helpers";
import { RequestStatusBadge } from "./RequestStatusBadge";

interface RequestCardProps {
  request: LocalMediaRequest;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  deleting?: boolean;
  retrying?: boolean;
}

export function RequestCard({ request, onDelete, onRetry, deleting, retrying }: RequestCardProps) {
  const poster = posterUrl(request.posterPath);
  const typeLabel = request.mediaType === "movie" ? "Film" : "Serie";
  const date = new Date(request.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex gap-4 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/8">
      {/* Poster */}
      <div className="h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg">
        {poster ? (
          <img src={poster} alt={request.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/20 text-[10px]">
            N/A
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <h3 className="truncate text-sm font-semibold text-white">{request.title}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-medium text-white/40">{typeLabel}</span>
            <RequestStatusBadge status={request.status} />
          </div>
          {request.seasons && request.seasons.length > 0 && (
            <p className="mt-0.5 text-[10px] text-white/30">
              Saison(s) : {request.seasons.join(", ")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/30">{date}</span>
          <div className="flex gap-2">
            {request.status === "failed" && onRetry && (
              <button
                onClick={() => onRetry(request.id)}
                disabled={retrying}
                className="rounded-md bg-purple-600/20 px-2.5 py-1 text-[10px] font-medium text-purple-400 transition-colors hover:bg-purple-600/30 disabled:opacity-50"
              >
                {retrying ? "..." : "Redemander"}
              </button>
            )}
            {onDelete && request.status !== "available" && (
              <button
                onClick={() => onDelete(request.id)}
                disabled={deleting}
                className="rounded-md bg-red-600/20 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-50"
              >
                {deleting ? "..." : "Supprimer"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
