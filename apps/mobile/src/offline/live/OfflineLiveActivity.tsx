import { useEffect } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { startLiveTransfers } from "./liveController";

/**
 * Le suivi en direct des transferts (Live Activity d'iOS, notification
 * permanente d'Android), branché sur le compte courant. Ne rend rien : le
 * contrôleur vit hors React (`liveController.ts`), pour suivre le moteur même
 * quand aucun écran ne rend.
 */
export function OfflineLiveActivity() {
  const userId = useUserId();
  useEffect(() => {
    if (userId === null) return;
    return startLiveTransfers(userId);
  }, [userId]);
  return null;
}
