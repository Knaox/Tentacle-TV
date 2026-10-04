import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FamilyProfileEndReason, WsServerMessage } from "@tentacle-tv/shared";
import { acquireSocket, onSocketStatus, subscribeSocket } from "../socket/tentacleSocket";
import type { SocketStatus } from "../socket/tentacleSocket";
import { FAMILY_KEY } from "./useFamily";

export interface UseFamilyLiveOptions {
  /** Auth par message (desktop/mobile/TV) ; undefined = cookie (web). */
  token?: string | null;
  enabled?: boolean;
  /** Apple TV : la session de profil vient de cesser (retrait, PIN changé,
   *  coupure par l'admin, déjumelage…) — revenir à « Qui regarde ? ». */
  onProfileEnded?: (reason: FamilyProfileEndReason) => void;
}

/**
 * La Famille en direct : sur `family:update`, la Famille se relit EN SILENCE
 * (une invitation reçue fait paraître l'affiche sans rechargement, une
 * réponse remplit la liste du propriétaire). Au retour « open » après une
 * coupure, un rattrapage. Consomme le socket PARTAGÉ (tentacleSocket) ; un
 * seul montage suffit par application.
 */
export function useFamilyLive(options: UseFamilyLiveOptions = {}): void {
  const { token, enabled = true, onProfileEnded } = options;
  const qc = useQueryClient();
  const endedRef = useRef(onProfileEnded);
  endedRef.current = onProfileEnded;

  useEffect(() => {
    if (!enabled) return;
    const release = acquireSocket(token ?? undefined);
    const refresh = () => void qc.invalidateQueries({ queryKey: [...FAMILY_KEY] });
    const offMessage = subscribeSocket((msg: WsServerMessage) => {
      if (msg.type === "family:update") refresh();
      else if (msg.type === "family:profile-ended") endedRef.current?.(msg.reason);
    });
    let hadOpen = false;
    let previous: SocketStatus | null = null;
    const offStatus = onSocketStatus((status) => {
      if (status === "open" && hadOpen && previous !== "open") refresh();
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
