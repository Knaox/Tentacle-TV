import { useEffect } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import { setLiveHidden, startLiveTransfers } from "./liveController";

interface Props {
  /**
   * Le compte dont on suit les transferts — celui de l'APPAREIL (le hors ligne
   * lui appartient, règle de Damien du 20/10). Absent : l'identité en session.
   */
  ownerUserId?: string | null;
  /** Une session de profil est ouverte : rien ne s'affiche, le lot continue. */
  hidden?: boolean;
}

/**
 * Le suivi en direct des transferts (Live Activity d'iOS, notification
 * permanente d'Android), branché sur le compte courant. Ne rend rien : le
 * contrôleur vit hors React (`liveController.ts`), pour suivre le moteur même
 * quand aucun écran ne rend.
 */
export function OfflineLiveActivity({ ownerUserId, hidden = false }: Props = {}) {
  const sessionUserId = useUserId();
  const userId = ownerUserId === undefined ? sessionUserId : ownerUserId;
  useEffect(() => {
    if (userId === null) return;
    return startLiveTransfers(userId);
  }, [userId]);
  useEffect(() => setLiveHidden(hidden), [hidden]);
  return null;
}
