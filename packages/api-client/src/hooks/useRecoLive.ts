import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acquireSocket, onSocketStatus, subscribeSocket } from "../socket/tentacleSocket";
import type { SocketStatus } from "../socket/tentacleSocket";
import { RECO_PAGE_KEY } from "./useRecoPage";

export interface UseRecoLiveOptions {
  /** Auth par message (desktop/mobile/TV) ; undefined = cookie (web). */
  token?: string | null;
  enabled?: boolean;
}

/**
 * Le fil temps réel de la page de recommandations : sur `reco:update`
 * (snapshot reconstruit en fond), la page en cache est invalidée EN SILENCE
 * — la donnée affichée reste, le refetch la remplace quand il arrive. Au
 * retour « open » après une coupure, une invalidation de rattrapage (les
 * messages manqués). Consomme le socket PARTAGÉ (tentacleSocket).
 */
export function useRecoLive(options: UseRecoLiveOptions = {}): void {
  const { token, enabled = true } = options;
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const release = acquireSocket(token ?? undefined);
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: [RECO_PAGE_KEY] });
    };
    const offMessage = subscribeSocket((msg) => {
      if (msg.type === "reco:update") invalidate();
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
