import { useState } from "react";
import { useMyRequests, useDeleteRequest, useRetryRequest } from "../hooks/useRequests";
import { RequestCard } from "./RequestCard";
import type { RequestStatus } from "../api/types";

const STATUS_TABS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "queued", label: "En attente" },
  { value: "processing", label: "En cours" },
  { value: "approved", label: "Approuvees" },
  { value: "available", label: "Disponibles" },
  { value: "failed", label: "Echecs" },
];

export function RequestsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const { data, isLoading } = useMyRequests(page, 20);
  const deleteMutation = useDeleteRequest();
  const retryMutation = useRetryRequest();

  const requests = data?.requests ?? [];
  const filtered = statusFilter === "all"
    ? requests
    : requests.filter((r) => r.status === statusFilter);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="px-4 pt-4 md:px-12">
      <h1 className="mb-6 text-2xl font-bold text-white">Mes demandes</h1>

      {/* Status filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Request list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onDelete={(id) => deleteMutation.mutate(id)}
              onRetry={(id) => retryMutation.mutate(id)}
              deleting={deleteMutation.isPending}
              retrying={retryMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-white/30">
          {statusFilter === "all"
            ? "Vous n'avez aucune demande"
            : "Aucune demande avec ce statut"}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 pb-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            Precedent
          </button>
          <span className="text-sm text-white/40">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 disabled:opacity-30"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
