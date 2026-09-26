import { useMemo } from "react";
import { useAllTickets, useMyTickets, type SupportTicket } from "@tentacle-tv/api-client";
import type { TicketStatus } from "./ticketMeta";

/** La liste de l'app ne pagine pas : une page large suffit (plafond serveur 200). */
const LIST_LIMIT = 100;

/**
 * La requête de `TicketListView` : l'admin voit TOUS les tickets, les autres
 * les leurs ; le filtre de statut part au serveur. Mêmes hooks que le tableau
 * du bureau (`useMyTickets` / `useAllTickets`), une seule requête active.
 */
export function useTicketList(isAdmin: boolean, filter: TicketStatus | "") {
  const status = filter || undefined;
  const mine = useMyTickets(status, 1, LIST_LIMIT, { enabled: !isAdmin });
  const all = useAllTickets(status, 1, LIST_LIMIT, { enabled: isAdmin });
  const query = isAdmin ? all : mine;
  const tickets = useMemo<SupportTicket[]>(() => query.data?.results ?? [], [query.data]);
  return { tickets, isLoading: query.isLoading, isError: query.isError };
}
