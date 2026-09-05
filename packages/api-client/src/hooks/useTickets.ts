import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

let _backendBase = "/api/tickets";

export function setTicketsBackendUrl(url: string) {
  _backendBase = `${url.replace(/\/$/, "")}/api/tickets`;
}

function getAuthHeader(): Record<string, string> {
  const token = typeof localStorage !== "undefined"
    ? localStorage.getItem("tentacle_token")
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ticketFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body) headers["Content-Type"] = "application/json";
  const hasToken = !!(typeof localStorage !== "undefined" && localStorage.getItem("tentacle_token"));
  const res = await fetch(`${_backendBase}${path}`, { ...init, headers, credentials: hasToken ? undefined : "include" });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status}`);
    throw new Error(msg);
  }
  return res.json();
}

// ---------- Types ----------

export interface TicketMessage {
  id: string;
  ticketId: string;
  jellyfinUserId: string;
  username: string;
  isAdmin: boolean;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  jellyfinUserId: string;
  username: string;
  subject: string;
  category: "general" | "bug" | "feature" | "account";
  status: "open" | "in_progress" | "resolved" | "closed";
  mediaItemId?: string | null;
  mediaItemName?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
  _count?: { messages: number };
}

export interface TicketsPage {
  results: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
}

// ---------- Hooks ----------

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      subject: string;
      category?: "general" | "bug" | "feature" | "account";
      body: string;
      mediaItemId?: string;
      mediaItemName?: string;
    }) => ticketFetch<SupportTicket>("/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

interface TicketListOptions {
  /** `false` : la requête ne part pas (le tableau ne charge qu'un scope). */
  enabled?: boolean;
}

/** Pas de page : 20 pour une liste, jusqu'à 200 pour le tableau (plafond serveur). */
export function useMyTickets(status?: string, page = 1, limit = 20, options?: TicketListOptions) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  const hasToken = typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));

  return useQuery({
    queryKey: ["tickets", "mine", status, page, limit],
    queryFn: () => ticketFetch<TicketsPage>(`/?${params}`),
    enabled: hasToken && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useAllTickets(status?: string, page = 1, limit = 20, options?: TicketListOptions) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  const hasToken = typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));

  return useQuery({
    queryKey: ["tickets", "all", status, page, limit],
    queryFn: () => ticketFetch<TicketsPage>(`/all?${params}`),
    enabled: hasToken && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

export function useTicketDetail(id: string | undefined) {
  const hasToken = typeof localStorage !== "undefined" && !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));

  return useQuery({
    queryKey: ["tickets", "detail", id],
    queryFn: () => ticketFetch<SupportTicket>(`/${id}`),
    enabled: hasToken && !!id,
    staleTime: 15_000,
  });
}

export function useReplyTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, body }: { ticketId: string; body: string }) =>
      ticketFetch<TicketMessage>(`/${ticketId}/reply`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["tickets", "detail", vars.ticketId] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

/** L'auteur ferme son ticket en disant pourquoi (motif obligatoire, versé au fil). */
export function useCloseTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, reason }: { ticketId: string; reason: string }) =>
      ticketFetch<SupportTicket>(`/${ticketId}/close`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (data, vars) => {
      qc.setQueryData(["tickets", "detail", vars.ticketId], data);
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

/** Admin : supprime un ou plusieurs tickets (messages et notifications compris). */
export function useDeleteTickets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) =>
      ticketFetch<{ deleted: number }>("/batch", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

type StatusVars = { ticketId: string; status: SupportTicket["status"] };

/** Le statut d'un ticket réécrit dans une page de liste ou dans un détail en cache. */
function patchTicketStatus(data: unknown, { ticketId, status }: StatusVars): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray((data as TicketsPage).results)) {
    const page = data as TicketsPage;
    return { ...page, results: page.results.map((t) => (t.id === ticketId ? { ...t, status } : t)) };
  }
  if ((data as SupportTicket).id === ticketId) return { ...(data as SupportTicket), status };
  return data;
}

/**
 * Optimiste : la carte change de colonne à l'instant du geste (glisser ou
 * sélecteur), le serveur confirme — ou tout revient à l'état d'avant.
 */
export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, status }: StatusVars) =>
      ticketFetch<SupportTicket>(`/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["tickets"] });
      const previous = qc.getQueriesData<unknown>({ queryKey: ["tickets"] });
      qc.setQueriesData<unknown>({ queryKey: ["tickets"] }, (data: unknown) => patchTicketStatus(data, vars));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) qc.setQueryData(key, data);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["tickets", "detail", vars.ticketId] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
