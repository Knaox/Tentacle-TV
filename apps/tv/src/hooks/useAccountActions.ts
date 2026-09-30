import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setPreferencesToken, useAuth, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { doLogout } from "../auth/sessionFlow";
import { navigationRef } from "../navigation/navigationRef";

/**
 * Les deux façons de quitter le compte depuis les réglages, sur les deux
 * téléviseurs :
 * - `logout` passe par `doLogout`, qui porte le verrou « lecture en cours » ;
 * - `changeServer` oublie le serveur (`useAuth().changeServer`) puis rouvre
 *   le jumelage.
 */
export function useAccountActions() {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const { mutate: forgetServer } = useAuth().changeServer;

  const logout = useCallback(() => {
    doLogout(jfClient, storage, queryClient);
  }, [jfClient, storage, queryClient]);

  const changeServer = useCallback(() => {
    forgetServer(undefined, {
      onSettled: () => {
        setPreferencesToken(null);
        navigationRef.reset({ index: 0, routes: [{ name: "PairCode" }] });
      },
    });
  }, [forgetServer]);

  return { logout, changeServer };
}
