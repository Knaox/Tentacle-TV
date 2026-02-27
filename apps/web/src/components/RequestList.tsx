import { useState } from "react";
import { useSeerrRequests, useSeerrRequestCount, useSeerrDeleteRequest, useSeerrRetryRequest } from "@tentacle-tv/api-client";
import type { SeerrMediaRequest } from "@tentacle-tv/api-client";

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvées" },
  { key: "available", label: "Disponibles" },
  { key: "failed", label: "Échouées" },
  { key: "declined", label: "Refusées" },
];

const REQUEST_STATUS: Record<number, { label: string; color: string }> = {
  1: { label: "En attente", color: "bg-yellow-500/20 text-yellow-400" },
  2: { label: "Approuvée", color: "bg-blue-500/20 text-blue-400" },
  3: { label: "Refusée", color: "bg-red-500/20 text-red-400" },
  4: { label: "Échec", color: "bg-red-700/20 text-red-500" },
  5: { label: "Complétée", color: "bg-green-500/20 text-green-400" },
};

const MEDIA_STATUS: Record<number, { label: string; color: string }> = {
  3: { label: "En cours", color: "bg-blue-500/20 text-blue-400" },
  4: { label: "Partiel", color: "bg-orange-500/20 text-orange-400" },
  5: { label: "Disponible", color: "bg-green-500/20 text-green-400" },
};

export function RequestList() {
  const [filter, setFilter] = useState("");
  const [skip, setSkip] = useState(0);
  const take = 20;

  const { data: counts } = useSeerrRequestCount();
  const { data, isLoading } = useSeerrRequests(filter || undefined, take, skip);
  const deleteMut = useSeerrDeleteRequest();
  const retryMut = useSeerrRetryRequest();

  const requests = data?.results ?? [];
  const totalPages = data?.pageInfo?.pages ?? 1;
  const currentPage = Math.floor(skip / take) + 1;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <FilterButton key={f.key} label={f.label} active={filter === f.key}
            count={counts?.[f.key === "" ? "total" : f.key]} onClick={() => { setFilter(f.key); setSkip(0); }} />
        ))}
      </div>

      {isLoading && <Spinner />}
      {!isLoading && requests.length === 0 && <Empty />}

      {!isLoading && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestRow key={req.id} req={req} onDelete={deleteMut.mutate} onRetry={retryMut.mutate} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={currentPage} totalPages={totalPages}
          onPrev={() => setSkip((s) => s - take)} onNext={() => setSkip((s) => s + take)} />
      )}
    </div>
  );
}

function FilterButton({ label, active, count, onClick }: {
  label: string; active: boolean; count?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active ? "bg-purple-600 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
    }`}>
      {label}
      {count != null && <span className="ml-1.5 text-xs opacity-60">({count})</span>}
    </button>
  );
}

function RequestRow({ req, onDelete, onRetry }: {
  req: SeerrMediaRequest;
  onDelete: (id: number) => void;
  onRetry: (p: { requestId: number; mediaType: "movie" | "tv"; mediaId: number }) => void;
}) {
  const reqStatus = REQUEST_STATUS[req.status];
  const mediaStatus = MEDIA_STATUS[req.media?.status];
  const date = new Date(req.createdAt).toLocaleDateString("fr-FR");
  const isFailed = req.status === 4;
  const isDeclined = req.status === 3;

  return (
    <div className="flex items-center gap-4 rounded-xl bg-white/5 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">
          #{req.media?.tmdbId}{" "}
          <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">
            {req.media?.mediaType === "movie" ? "Film" : "Série"}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-white/40">
          {req.requestedBy?.displayName || req.requestedBy?.username || "Utilisateur"} — {date}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {reqStatus && (
          <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${reqStatus.color}`}>{reqStatus.label}</span>
        )}
        {mediaStatus && (
          <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${mediaStatus.color}`}>{mediaStatus.label}</span>
        )}
        {(isFailed || isDeclined) && (
          <button onClick={() => onRetry({ requestId: req.id, mediaType: req.media?.mediaType, mediaId: req.media?.tmdbId })}
            className="rounded-lg bg-tentacle-accent/20 px-2.5 py-1 text-xs font-medium text-purple-400 transition-colors hover:bg-tentacle-accent/40"
            title="Re-demander">
            Re-demander
          </button>
        )}
        <button onClick={() => onDelete(req.id)}
          className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
          title="Supprimer">
          Supprimer
        </button>
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

function Empty() {
  return <p className="py-20 text-center text-white/40">Aucune demande</p>;
}

function Pagination({ page, totalPages, onPrev, onNext }: {
  page: number; totalPages: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <button disabled={page <= 1} onClick={onPrev}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 disabled:opacity-30">
        Précédent
      </button>
      <span className="text-sm text-white/50">Page {page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={onNext}
        className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 disabled:opacity-30">
        Suivant
      </button>
    </div>
  );
}
