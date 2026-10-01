import { useCallback } from "react";
import { useUnpairDevice } from "./useUnpairDevice";

/**
 * « Déjumeler » depuis le voile hors ligne, sur les deux téléviseurs : le
 * déjumelage commun (`unpairDevice`), qui ne dépend pas du serveur — la purge
 * est locale et immédiate, la révocation part dès que le serveur revient — et
 * qui passe même pendant une lecture.
 */
export function useOfflineLogout() {
  const unpair = useUnpairDevice();
  return useCallback(() => unpair("offline"), [unpair]);
}
