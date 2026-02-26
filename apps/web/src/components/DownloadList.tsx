import { useTranslation } from "react-i18next";
import { useSeerrRequests, useSeerrMediaDetail } from "@tentacle/api-client";
import type { SeerrMediaRequest } from "@tentacle/api-client";

const TMDB_IMG = "https://image.tmdb.org/t/p";

const MEDIA_STATUS_COLORS: Record<number, string> = {
  2: "bg-yellow-500/20 text-yellow-400",
  3: "bg-blue-500/20 text-blue-400",
  4: "bg-orange-500/20 text-orange-400",
};

export function DownloadList() {
  const { t } = useTranslation("requests");

  const MEDIA_STATUS_LABELS: Record<number, string> = {
    2: t("requests:downloadPending"),
    3: t("requests:downloadInProgress"),
    4: t("requests:downloadPartial"),
  };

  const { data, isLoading } = useSeerrRequests("approved", 50, 0);

  const downloads = (data?.results ?? []).filter(
    (req) => req.media?.status >= 2 && req.media?.status <= 4
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
      </div>
    );
  }

  if (downloads.length === 0) {
    return <p className="py-20 text-center text-white/40">{t("requests:noDownloads")}</p>;
  }

  return (
    <div className="space-y-3">
      {downloads.map((req) => <DownloadRow key={req.id} req={req} statusLabels={MEDIA_STATUS_LABELS} t={t} />)}
    </div>
  );
}

function DownloadRow({ req, statusLabels, t }: { req: SeerrMediaRequest; statusLabels: Record<number, string>; t: (key: string, opts?: Record<string, string>) => string }) {
  const { data: detail } = useSeerrMediaDetail(req.media?.mediaType, req.media?.tmdbId);

  const title = detail?.title || detail?.name || `#${req.media?.tmdbId}`;
  const poster = detail?.posterPath ? `${TMDB_IMG}/w92${detail.posterPath}` : null;
  const statusLabel = statusLabels[req.media?.status];
  const statusColor = MEDIA_STATUS_COLORS[req.media?.status];
  const seasons = req.seasons?.filter((s) => s.status < 5);

  return (
    <div className="flex items-center gap-4 rounded-xl bg-white/5 px-5 py-4">
      {poster ? (
        <img src={poster} alt={title} className="h-16 w-11 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-11 items-center justify-center rounded-lg bg-blue-500/20">
          <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {title}{" "}
          <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">
            {req.media?.mediaType === "movie" ? t("common:movie") : t("common:series")}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-white/40">
          {t("requests:updatedOn", { date: new Date(req.updatedAt).toLocaleDateString() })}
          {seasons && seasons.length > 0 && (
            <span> — Saisons : {seasons.map((s) => s.seasonNumber).join(", ")}</span>
          )}
        </p>
      </div>
      {statusLabel && statusColor && (
        <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      )}
    </div>
  );
}
