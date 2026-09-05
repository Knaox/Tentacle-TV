import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acquireSocket, onSocketStatus, subscribeSocket } from "../socket/tentacleSocket";
import type { SocketStatus } from "../socket/tentacleSocket";

/**
 * Les requêtes qu'une notification fraîche périme : la cloche, et les tickets
 * — une notif de ticket signifie qu'un ticket vient de bouger, le tableau que
 * l'admin regarde se rafraîchit en direct. `["ticket"]` est la clé du détail
 * de l'app mobile.
 */
export const NOTIFICATION_LIVE_KEYS: readonly (readonly string[])[] = [
  ["notifications"],
  ["tickets"],
  ["ticket"],
];

export interface UseNotificationsLiveOptions {
  /** Auth par message (desktop/mobile/TV) ; undefined = cookie (web). */
  token?: string | null;
  enabled?: boolean;
}

/**
 * Le fil temps réel de la cloche : sur `notifications:update` (une ligne
 * vient d'être écrite pour cet utilisateur) ou sur `home:update` du canal
 * `notifications` (suppressions), les requêtes ci-dessus sont invalidées EN
 * SILENCE. Au retour « open » après une coupure, une invalidation de
 * rattrapage. Consomme le socket PARTAGÉ (tentacleSocket), comme useRecoLive
 * — la cloche vit sur toutes les pages, pas seulement l'accueil.
 */
export function useNotificationsLive(options: UseNotificationsLiveOptions = {}): void {
  const { token, enabled = true } = options;
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const release = acquireSocket(token ?? undefined);
    const invalidate = () => {
      for (const queryKey of NOTIFICATION_LIVE_KEYS) {
        void qc.invalidateQueries({ queryKey: [...queryKey] });
      }
    };
    const offMessage = subscribeSocket((msg) => {
      if (msg.type === "notifications:update") invalidate();
      else if (msg.type === "home:update" && msg.carousel === "notifications") invalidate();
    });
    let hadOpen = false;
    let previous: SocketStatus | null = null;
    const offStatus = onSocketStatus((status) => {
      if (status === "open" && hadOpen && previous !== "open") invalidate();
      if (status === "open") hadOpen = true;
      previous = status;
    });
    return () => {
      offMessage();
      offStatus();
      release();
    };
  }, [enabled, token, qc]);
}
