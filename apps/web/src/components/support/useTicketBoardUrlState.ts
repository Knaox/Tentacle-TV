import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * L'état du tableau qui vit dans l'adresse : `?ticketId=` ouvre la fiche,
 * `?new=1` le formulaire. C'est ce qui rend `/support?ticketId=…` et
 * `/admin/tickets?ticketId=…` (les liens des notifications) fonctionnels, et
 * ce qui fait que le retour navigateur ferme la fiche : ouvrir empile une
 * entrée, fermer remplace la courante.
 */
export interface TicketBoardUrlState {
  ticketId: string | null;
  composing: boolean;
  openTicket: (id: string) => void;
  closeTicket: () => void;
  openComposer: () => void;
  closeComposer: () => void;
}

export function useTicketBoardUrlState(): TicketBoardUrlState {
  const [params, setParams] = useSearchParams();
  const ticketId = params.get("ticketId");
  const composing = params.get("new") === "1";

  const openTicket = useCallback(
    (id: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("ticketId", id);
        next.delete("new");
        return next;
      });
    },
    [setParams],
  );
  const closeTicket = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("ticketId");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);
  const openComposer = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("new", "1");
      return next;
    });
  }, [setParams]);
  const closeComposer = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("new");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return { ticketId, composing, openTicket, closeTicket, openComposer, closeComposer };
}
