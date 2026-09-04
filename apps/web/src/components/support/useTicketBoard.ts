import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAllTickets,
  useMyTickets,
  useUpdateTicketStatus,
  type SupportTicket,
} from "@tentacle-tv/api-client";
import { useToast } from "../../contexts/ToastContext";
import { TICKET_STATUSES, type TicketStatus } from "./ticketMeta";

/** `mine` = la page de support (ses propres tickets), `all` = l'admin. */
export type TicketBoardScope = "mine" | "all";

/** Le tableau charge tout d'un coup ; c'est le plafond du serveur. */
const BOARD_LIMIT = 200;

export interface TicketBoardState {
  columns: Record<TicketStatus, SupportTicket[]>;
  isLoading: boolean;
  isError: boolean;
  /** Tickets au-delà du plafond, non affichés (les plus anciens). */
  hiddenCount: number;
  search: string;
  setSearch: (value: string) => void;
  /** Seul l'admin déplace les cartes (la page l'a déjà gardé). */
  canMove: boolean;
  moveTicket: (id: string, status: TicketStatus) => void;
}

function emptyColumns(): Record<TicketStatus, SupportTicket[]> {
  return { open: [], in_progress: [], resolved: [], closed: [] };
}

export function useTicketBoard(scope: TicketBoardScope): TicketBoardState {
  const { t } = useTranslation("tickets");
  const { show } = useToast();
  const [search, setSearch] = useState("");

  const mine = useMyTickets(undefined, 1, BOARD_LIMIT, { enabled: scope === "mine" });
  const all = useAllTickets(undefined, 1, BOARD_LIMIT, { enabled: scope === "all" });
  const query = scope === "all" ? all : mine;
  const update = useUpdateTicketStatus();

  const results = useMemo(() => query.data?.results ?? [], [query.data]);
  const total = query.data?.total ?? 0;

  // Filtre texte côté client : sujet, média, et l'auteur pour l'admin.
  const needle = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!needle) return results;
    return results.filter((tk) =>
      [tk.subject, tk.mediaItemName ?? "", scope === "all" ? tk.username : ""].some((s) =>
        s.toLowerCase().includes(needle),
      ),
    );
  }, [results, needle, scope]);

  const columns = useMemo(() => {
    const cols = emptyColumns();
    for (const tk of filtered) {
      // Un statut inconnu (serveur plus récent) atterrit dans « Ouvert »
      // plutôt que de disparaître.
      (TICKET_STATUSES.includes(tk.status) ? cols[tk.status] : cols.open).push(tk);
    }
    return cols;
  }, [filtered]);

  const moveTicket = useCallback(
    (id: string, status: TicketStatus) => {
      update.mutate(
        { ticketId: id, status },
        { onError: () => show("error", t("statusUpdateFailed")) },
      );
    },
    [update, show, t],
  );

  return {
    columns,
    isLoading: query.isLoading,
    isError: query.isError,
    hiddenCount: Math.max(0, total - results.length),
    search,
    setSearch,
    canMove: scope === "all",
    moveTicket,
  };
}
