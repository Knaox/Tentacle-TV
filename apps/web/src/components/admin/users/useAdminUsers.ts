import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { retryUnlessRateLimited } from "../../../lib/retryPolicy";
import type { AdminUser } from "./userListModel";

/**
 * Un refus du serveur Tentacle, avec son statut. L'écran en distingue deux :
 * 503, Jellyfin n'est pas configuré — rien à retenter, il faut passer par
 * Services ; 502, Jellyfin n'a pas répondu, ou a refusé la clé d'administration.
 */
export class AdminRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "AdminRequestError";
    this.status = status;
  }
}

async function fetchUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${BACKEND}/api/admin/users`, { headers: hdrs(), credentials: creds() });
  if (!res.ok) throw new AdminRequestError(res.status);
  return res.json();
}

/**
 * Relue chaque minute tant que l'écran est ouvert — et seulement tant que
 * l'onglet est au premier plan (défaut de TanStack) : l'activité des comptes
 * bouge, et les « il y a 3 min » se calculent sur l'heure de cette relève.
 */
const REFRESH_MS = 60_000;

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
    retry: (count, error) =>
      !(error instanceof AdminRequestError && error.status === 503) && retryUnlessRateLimited(count, error),
  });
}

/**
 * La fiche ouverte vit dans l'adresse (`?user=<id>`), comme celle d'un ticket :
 * un lien peut y mener, et le retour du navigateur la referme. Ouvrir empile
 * une entrée, fermer remplace la courante.
 */
export function useUserSheetParam() {
  const [params, setParams] = useSearchParams();
  const userId = params.get("user");

  const open = useCallback(
    (id: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("user", id);
        return next;
      });
    },
    [setParams],
  );

  const close = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("user");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return { userId, open, close };
}
