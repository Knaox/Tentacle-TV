import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WsServerMessage, CarouselId } from "@tentacle-tv/shared";

// ── Backend URL configuration ──

let _wsUrl = "";

/** Set the WebSocket backend URL. Converts http(s):// to ws(s)://. */
export function setWsBackendUrl(url: string) {
  if (!url && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    _wsUrl = `${proto}//${window.location.host}/api/ws`;
  } else {
    _wsUrl = url.replace(/^http/, "ws").replace(/\/$/, "") + "/api/ws";
  }
}

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
}

const INITIAL_BACKOFF = 1_000;
const MAX_BACKOFF = 30_000;
const PING_INTERVAL = 30_000;

export function useHomeWebSocket(options: UseHomeWebSocketOptions = {}) {
  const { token, enabled = true, fallbackInterval = 60_000 } = options;
  const qc = useQueryClient();

  // Store volatile values in refs so the effect doesn't re-run on every render
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const qcRef = useRef(qc);
  qcRef.current = qc;

  useEffect(() => {
    if (!enabled || !_wsUrl) return;

    let mounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let backoff = INITIAL_BACKOFF;

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

    function connect() {
      if (!mounted) return;

      try {
        ws = new WebSocket(_wsUrl);
      } catch {
        startFallback();
        return;
      }

      ws.onopen = () => {
        // If unmounted while connecting, close now that handshake is done (no browser error)
        if (!mounted) { ws?.close(); return; }

        backoff = INITIAL_BACKOFF;
        stopFallback();

        if (tokenRef.current && ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "auth", token: tokenRef.current }));
        }

        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsServerMessage = JSON.parse(String(event.data));
          if (msg.type === "home:update") {
            invalidateCarousel(msg.carousel);
          } else if (msg.type === "notifications:update") {
            qcRef.current.invalidateQueries({ queryKey: ["notifications"] });
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        ws = null;
        if (!mounted) return;
        startFallback();
        const delay = backoff;
        backoff = Math.min(delay * 2, MAX_BACKOFF);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => { /* onclose fires after — handled there */ };
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      stopFallback();
      if (ws) {
        // Detach handlers to prevent reconnection attempts
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        // Only close OPEN sockets — CONNECTING ones will be closed in onopen
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        ws = null;
      }
    };
  }, [enabled, fallbackInterval]);
}
