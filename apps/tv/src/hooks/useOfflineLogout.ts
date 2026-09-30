import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { useTentacleConfig } from "@tentacle-tv/api-client";

/**
 * « Se déconnecter » du voile hors ligne, sur les deux téléviseurs : la
 * session locale s'efface et le jumelage rouvre. Pas de `doLogout` ici : le
 * serveur ne répond plus, et l'utilisateur qui le demande veut sortir même
 * pendant une lecture.
 */
export function useOfflineLogout() {
  const { storage } = useTentacleConfig();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  return useCallback(() => {
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    storage.removeItem("tentacle_jellyfin_token");
    storage.removeItem("tentacle_jellyfin_url");
    queryClient.clear();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "PairCode" as never }] }));
  }, [storage, navigation, queryClient]);
}
