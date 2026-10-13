import type { QueryClient } from "@tanstack/react-query";
import { notifyUserChange, type JellyfinClient } from "@tentacle-tv/api-client";
import { forgetProfileSession } from "./sessionSwap";
import { setSessionExpired } from "./sessionState";

/**
 * La SESSION PERSONNELLE du bureau a été refusée par le serveur (401 sur une
 * route de « Qui regarde ? ») : elle est morte, et avec elle tout ce qu'elle
 * portait — la session de profil ouverte par elle comprise. Purge locale, sans
 * navigation (le garde de routes renvoie à la connexion) ; l'écran de
 * connexion dit que la session a expiré.
 */
export function dropAllSessions(client: Pick<JellyfinClient, "setAccessToken">, queryClient: Pick<QueryClient, "clear">): void {
  client.setAccessToken(null);
  try {
    forgetProfileSession(localStorage);
    localStorage.removeItem("tentacle_token");
    localStorage.removeItem("tentacle_user");
  } catch {
    /* stockage indisponible : la session en mémoire tombe quand même */
  }
  queryClient.clear();
  setSessionExpired(true);
  notifyUserChange();
}
