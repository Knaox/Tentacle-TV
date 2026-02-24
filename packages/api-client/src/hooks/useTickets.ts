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
  const res = await fetch(`${_backendBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers as Record<string, string>),
    },
  });
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
    }) => ticketFetch<SupportTicket>("/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

export function useMyTickets(status?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) params.set("status", status);
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["tickets", "mine", status, page],
    queryFn: () => ticketFetch<TicketsPage>(`/?${params}`),
    enabled: hasToken,
    staleTime: 30_000,
  });
}

export function useAllTickets(status?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) params.set("status", status);
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

  return useQuery({
    queryKey: ["tickets", "all", status, page],
    queryFn: () => ticketFetch<TicketsPage>(`/all?${params}`),
    enabled: hasToken,
    staleTime: 30_000,
  });
}

export function useTicketDetail(id: string | undefined) {
  const hasToken = typeof localStorage !== "undefined" && !!localStorage.getItem("tentacle_token");

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

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) =>
      ticketFetch<SupportTicket>(`/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["tickets", "detail", vars.ticketId] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}
