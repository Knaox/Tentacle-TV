import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAllRequests, useCancelRequest, useRetryRequest } from "@tentacle-tv/api-client";
import type { MediaRequest } from "@tentacle-tv/api-client";
import { Navbar } from "../components/Navbar";

const TMDB_IMG = "https://image.tmdb.org/t/p";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  submitted: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-blue-500/20 text-blue-400",
  available: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  declined: "bg-red-700/20 text-red-500",
};

export function Requests() {
  const { t } = useTranslation("requests");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAllRequests(filter || undefined, page);
  const cancelMut = useCancelRequest();
  const retryMut = useRetryRequest();

  const requests = data?.results ?? [];
  const totalPages = data?.totalPages ?? 1;

  const FILTERS: { key: string; label: string }[] = [
    { key: "", label: t("requests:all") },
    { key: "pending", label: t("requests:pending") },
    { key: "submitted", label: t("requests:inProgress") },
    { key: "approved", label: t("requests:approved") },
    { key: "available", label: t("requests:available") },
    { key: "failed", label: t("requests:failed") },
    { key: "declined", label: t("requests:declined") },
  ];

  const STATUS_LABELS: Record<string, string> = {
    pending: t("requests:statusPending"),
    submitted: t("requests:statusSubmitted"),
    approved: t("requests:statusApproved"),
    available: t("requests:statusAvailable"),
    failed: t("requests:statusFailed"),
    declined: t("requests:statusDeclined"),
  };

  return (
    <div className="min-h-screen bg-tentacle-bg">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 pt-24 pb-12">
        <h1 className="mb-6 text-2xl font-bold text-white">{t("requests:title")}</h1>

        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-tentacle-accent border-t-transparent" />
          </div>
        )}

        {!isLoading && requests.length === 0 && (
          <p className="py-20 text-center text-white/40">{t("requests:noRequests")}</p>
        )}

        {!isLoading && requests.length > 0 && (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestRow key={req.id} req={req}
                statusLabels={STATUS_LABELS}
                t={t}
                onCancel={() => cancelMut.mutate(req.id)}
                onRetry={() => retryMut.mutate(req.id)} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 disabled:opacity-30">
              {t("common:previous")}
            </button>
            <span className="text-sm text-white/50">{t("common:page", { page, total: totalPages })}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 disabled:opacity-30">
              {t("common:next")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function RequestRow({ req, statusLabels, t, onCancel, onRetry }: {
  req: MediaRequest;
  statusLabels: Record<string, string>;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const poster = req.posterPath ? `${TMDB_IMG}/w92${req.posterPath}` : null;
  const date = new Date(req.createdAt).toLocaleDateString();
  const canCancel = ["pending", "failed", "submitted"].includes(req.status);
  const canRetry = req.status === "failed";

  return (
    <div className="flex items-center gap-4 rounded-xl bg-white/5 px-5 py-4">
      {poster ? (
        <img src={poster} alt={req.title} className="h-16 w-11 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-11 items-center justify-center rounded-lg bg-white/10 text-xs text-white/30">
          {t("common:notAvailable")}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{req.title}</p>
        <p className="mt-0.5 text-xs text-white/40">
          {req.mediaType === "movie" ? t("common:movie") : t("common:series")} — {date}
        </p>
        <p className="text-xs text-white/30">{t("requests:requestedBy", { name: req.username })}</p>
        {req.lastError && (
          <p className="mt-1 text-xs text-red-400 truncate">{req.lastError}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[req.status] ?? ""}`}>
          {statusLabels[req.status] ?? req.status}
        </span>
        {canRetry && (
          <button onClick={onRetry}
            className="rounded-lg bg-tentacle-accent/20 px-2.5 py-1 text-xs font-medium text-purple-400 hover:bg-tentacle-accent/40">
            {t("requests:retry")}
          </button>
        )}
        {canCancel && (
          <button onClick={onCancel}
            className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/25">
            {t("common:cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
