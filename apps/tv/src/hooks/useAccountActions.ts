import { useCallback } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useUnpairDevice } from "./useUnpairDevice";

/**
 * Les deux façons de quitter le compte depuis les réglages, sur les deux
 * téléviseurs — toutes deux un déjumelage complet (`unpairDevice`) :
 * - `logout` garde l'adresse du serveur, pour rejumeler sans la ressaisir ;
 * - `changeServer` l'oublie aussi. La révocation, mise en file AVANT, garde
 *   l'adresse du serveur qu'on quitte.
 */
export function useAccountActions() {
  const { storage } = useTentacleConfig();
  const unpair = useUnpairDevice();

  const logout = useCallback(() => unpair("settings"), [unpair]);

  const changeServer = useCallback(() => {
    unpair("settings");
    storage.removeItem("tentacle_server_url");
  }, [unpair, storage]);

  return { logout, changeServer };
}
