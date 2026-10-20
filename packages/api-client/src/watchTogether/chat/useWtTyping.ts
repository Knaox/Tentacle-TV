import { useCallback, useEffect, useRef } from "react";
import { WT_TYPING_IDLE_MS, WT_TYPING_RESEND_MS, type WsClientMessage } from "@tentacle-tv/shared";

/**
 * « Est en train d'écrire » — le côté qui TAPE : `notifyTyping()` à chaque
 * frappe ; le crochet dit `typing: true` au plus toutes les 2 s tant qu'on
 * tape, puis `false` après 4 s sans frappe — rien au repos. `sent()` : le
 * message est parti, le serveur a déjà éteint l'indicateur chez les autres.
 * `enabled` faux (serveur sans `watchTogether.typing`, hors salle) : rien.
 */
export function useWtTyping(
  send: (msg: WsClientMessage) => boolean,
  enabled: boolean,
  groupId: string | null,
): { notifyTyping: () => void; sent: () => void } {
  const lastSentAtRef = useRef(0);
  const activeRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  const clearIdle = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  };

  const stop = useCallback((tell: boolean) => {
    clearIdle();
    if (activeRef.current && tell) sendRef.current({ type: "wt:typing", typing: false });
    activeRef.current = false;
    lastSentAtRef.current = 0;
  }, []);

  const notifyTyping = useCallback(() => {
    if (!enabled) return;
    const now = Date.now();
    if (!activeRef.current || now - lastSentAtRef.current >= WT_TYPING_RESEND_MS) {
      if (sendRef.current({ type: "wt:typing", typing: true })) {
        activeRef.current = true;
        lastSentAtRef.current = now;
      }
    }
    clearIdle();
    idleTimerRef.current = setTimeout(() => stop(true), WT_TYPING_IDLE_MS);
  }, [enabled, stop]);

  // Le message part : le serveur éteint l'indicateur lui-même.
  const sent = useCallback(() => stop(false), [stop]);

  // Autre salle, sortie, démontage : on cesse de « taper ».
  useEffect(() => () => stop(true), [groupId, enabled, stop]);

  return { notifyTyping, sent };
}
