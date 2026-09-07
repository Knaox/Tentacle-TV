import { useEffect } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { rememberItemTracks, type ItemTrackChoice } from "@tentacle-tv/offline-core";
import { prefsStore, pushItemTrackChoice } from "@/offline/prefsCache";
import { useConnectivity } from "@/offline/useConnectivity";
import { useServerUrl } from "@/providers/ServerUrlContext";

interface Options {
  userId: string | null;
  itemId: string;
  /** Le choix courant — retenu seulement après un geste EXPLICITE de l'utilisateur. */
  choice: ItemTrackChoice | null;
}

/**
 * Mémorise les langues choisies pendant une lecture locale : le miroir local
 * d'abord (la prochaine lecture hors ligne le relira), puis le serveur si
 * on est en ligne — le même choix se retrouve sur les autres appareils.
 */
export function useRememberLocalTracks({ userId, itemId, choice }: Options): void {
  const { serverUrl } = useServerUrl();
  const { storage } = useTentacleConfig();
  const { state } = useConnectivity();
  const online = state === "online";

  useEffect(() => {
    if (userId === null || choice === null) return;
    try {
      rememberItemTracks(prefsStore, userId, itemId, choice);
    } catch {
      // Base locale indisponible : le choix vaut pour cette lecture.
    }
    const token = storage.getItem("tentacle_token");
    if (online && serverUrl && token) void pushItemTrackChoice(serverUrl, token, itemId, choice);
    // `online`, `serverUrl` et `storage` ne doivent pas re-pousser un choix déjà retenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, itemId, choice]);
}
