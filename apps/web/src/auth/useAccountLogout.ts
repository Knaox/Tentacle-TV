import { useCallback } from "react";
import { useAuth } from "@tentacle-tv/api-client";
import { isDesktopApp } from "../desktop/detect";
import { getBackendBase } from "../lib/backendBase";
import { accountToken } from "./profileSession";
import { forgetProfileSession } from "./sessionSwap";

/** La déconnexion ne doit jamais attendre plus que ça un serveur muet. */
const LOGOUT_BUDGET_MS = 3000;

/**
 * Se déconnecter du COMPTE. Sur le bureau, le serveur en est prévenu par la
 * session PERSONNELLE (`POST /api/auth/logout` en Bearer — le bureau ne
 * l'appelait pas) : il coupe alors les sessions de profil de l'appareil
 * avant de répondre, et rien d'un profil ouvert ici ne survit à la sortie du
 * compte. Puis la purge locale de toujours (`useAuth().logout`), sans attendre
 * plus de trois secondes un serveur qui ne répond pas.
 */
export function useAccountLogout() {
  const { logout } = useAuth();
  return useCallback((onDone: () => void) => {
    const serverSide = isDesktopApp() ? endAccountOnServer() : Promise.resolve();
    void serverSide.finally(() => {
      try {
        forgetProfileSession(localStorage);
      } catch {
        /* stockage indisponible : rien à oublier */
      }
      logout.mutate(undefined, { onSuccess: onDone });
    });
  }, [logout]);
}

async function endAccountOnServer(): Promise<void> {
  const token = accountToken();
  if (!token) return;
  try {
    await fetch(`${getBackendBase()}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(LOGOUT_BUDGET_MS),
    });
  } catch {
    /* serveur muet : la purge locale suit quand même */
  }
}
