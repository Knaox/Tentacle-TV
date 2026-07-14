import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CarouselId } from "@tentacle-tv/shared";
import { acquireSocket, onSocketStatus, subscribeSocket } from "../socket/tentacleSocket";

// Ré-export de compatibilité : la configuration de l'URL vit désormais dans le
// socket partagé (utilisée aussi par Watch Together), l'API publique ne change pas.
export { setWsBackendUrl } from "../socket/tentacleSocket";

// ── Carousel → TanStack Query key mapping ──

const CAROUSEL_KEYS: Record<string, string[][]> = {
  continue_watching: [["resume-items"], ["next-up"]],
  recently_added:    [["latest-items"]],
  next_up:           [["next-up"]],
  trending:          [["featured"]],
  watchlist:         [["watchlist"]],
  watched:           [["watched-items"]],
  featured:          [["featured"]],
  notifications:     [["notifications"]],
};

// ── Hook options ──

interface UseHomeWebSocketOptions {
  /** Auth token for mobile/TV/desktop. Web uses cookie automatically. */
  token?: string | null;
  /** Enable the connection. Default: true. */
  enabled?: boolean;
  /** Polling fallback interval (ms) when WS disconnected. Default: 60000. */
  fallbackInterval?: number;
  /** Called when WebSocket receives an auth error (invalid token). */
  onAuthError?: () => void;
  /** Called when the server pushes `session:revoked` (device pairing removed).
   *  The consumer should log out / reset to the pairing screen. */
  onSessionRevoked?: () => void;
}

/**
 * Rafraîchissement temps réel de la Home (carrousels + notifications).
 * Consomme le socket Tentacle PARTAGÉ (socket/tentacleSocket.ts) — la
 * connexion, l'auth, le keepalive et la reconnexion y sont mutualisés avec les
 * autres consommateurs (Watch Together). Ce hook ne garde que le mapping
 * carrousel → invalidations TanStack Query et le polling de repli.
 */
export function useHomeWebSocket(options: UseHomeWebSocketOptions = {}) {
  const { token, enabled = true, fallbackInterval = 60_000, onAuthError, onSessionRevoked } = options;
  const qc = useQueryClient();

  // Store volatile values in refs so the effect doesn't re-run on every render
  const qcRef = useRef(qc);
  qcRef.current = qc;
  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;
  const onSessionRevokedRef = useRef(onSessionRevoked);
  onSessionRevokedRef.current = onSessionRevoked;

  useEffect(() => {
    if (!enabled) return;

    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    function invalidateCarousel(carousel: CarouselId) {
      const keys = CAROUSEL_KEYS[carousel];
      if (keys) {
        for (const key of keys) qcRef.current.invalidateQueries({ queryKey: key });
      } else {
        qcRef.current.invalidateQueries({ queryKey: [carousel] });
      }
    }

    function startFallback() {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => {
        for (const keys of Object.values(CAROUSEL_KEYS)) {
          for (const key of keys) qcRef.current.invalidateQueries({ queryKey: key });
        }
      }, fallbackInterval);
    }

    function stopFallback() {
      if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
    }

    // Pas de connexion tant qu'aucun token n'est disponible (hors web, qui auth
    // par cookie → token `undefined`) ; `token` est dans les deps → connexion
    // dès qu'il arrive.
    if (token === null) {
      startFallback();
      return () => stopFallback();
    }

    const releaseSocket = acquireSocket(token);

    const unsubscribeMessages = subscribeSocket((msg) => {
      if (msg.type === "home:update") {
        invalidateCarousel(msg.carousel);
      } else if (msg.type === "notifications:update") {
        qcRef.current.invalidateQueries({ queryKey: ["notifications"] });
      } else if (msg.type === "session:revoked") {
        onSessionRevokedRef.current?.();
      }
    });

    const unsubscribeStatus = onSocketStatus((status) => {
      if (status === "open") {
        stopFallback();
      } else if (status === "closed" || status === "authError") {
        startFallback();
        if (status === "authError") onAuthErrorRef.current?.();
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeStatus();
      releaseSocket();
      stopFallback();
    };
  }, [enabled, fallbackInterval, token]);
}
