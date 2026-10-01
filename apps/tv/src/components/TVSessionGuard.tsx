import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeSocket, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { runAuthRefreshFlow } from "../auth/sessionFlow";
import { useUnpairDevice } from "../hooks/useUnpairDevice";

/**
 * La révocation de CE jumelage, entendue où qu'on soit — accueil, fiche,
 * réglages, lecture. Elle n'était écoutée que sur l'accueil : une TV laissée
 * sur un autre écran gardait sa session révoquée.
 *
 * - `session:revoked` : poussé par le serveur aux sockets du jeton qu'il vient
 *   de révoquer. Cru tel quel s'il vise le jeton avec lequel la socket s'est
 *   authentifiée et qui est encore celui de la session ; sinon (rejumelé
 *   entre-temps, garde montée après l'authentification) le verdict est
 *   redemandé au serveur pour le jeton COURANT.
 * - `auth_error` « revoked » : la socket a été refusée parce que le jumelage
 *   n'existe plus — typiquement une TV éteinte pendant qu'on la déjumelait.
 *   Le refus ne dit pas quel jeton il visait : le verdict est redemandé pour
 *   le jeton courant (`/api/auth/refresh`), qui seul déjumelle.
 */
export function TVSessionGuard() {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const unpair = useUnpairDevice();

  useEffect(() => {
    let boundToken: string | null = null;
    const verify = () => void runAuthRefreshFlow(jfClient, storage, queryClient, { softFail: false });
    return subscribeSocket((msg) => {
      if (msg.type === "auth_ok") {
        boundToken = storage.getItem("tentacle_token");
      } else if (msg.type === "session:revoked") {
        const current = storage.getItem("tentacle_token");
        if (current && current === boundToken) unpair("revoked");
        else if (current) verify();
      } else if (msg.type === "auth_error" && msg.reason === "revoked") {
        verify();
      }
    });
  }, [storage, queryClient, jfClient, unpair]);

  return null;
}
