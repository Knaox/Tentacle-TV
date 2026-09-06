import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateProgress } from "@tentacle-tv/offline-core/react";
import { subscribeOfflineChanged, subscribeOfflineProgress } from "./engineRuntime";
import { OFFLINE_DISK_QUERY_KEY, OFFLINE_LIST_QUERY_KEY, OFFLINE_STATE_QUERY_KEY } from "@/hooks/offline/useOfflineList";

/** Les requêtes locales que « quelque chose a changé » rend périmées. */
const CHANGED_KEYS = [OFFLINE_LIST_QUERY_KEY, OFFLINE_STATE_QUERY_KEY, OFFLINE_DISK_QUERY_KEY, "local-source"];

/**
 * Les évènements du moteur vers l'interface : un changement invalide les
 * listes locales ; une progression alimente le magasin des barres, sans
 * passer par TanStack (deux invalidations par seconde et par transfert). La
 * progression d'un transfert annulé ou retiré est purgée par la façade — la
 * base fait foi ensuite. Ne rend rien.
 */
export function OfflineEventsBinding() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribeChanged = subscribeOfflineChanged(() => {
      for (const key of CHANGED_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
    });
    const unsubscribeProgress = subscribeOfflineProgress((payload) => {
      updateProgress(payload.fileId, { bytesDone: payload.bytesDone, expectedSize: payload.expectedSize });
    });
    return () => {
      unsubscribeChanged();
      unsubscribeProgress();
    };
  }, [queryClient]);

  return null;
}
