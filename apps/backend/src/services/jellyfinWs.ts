import WebSocket from "ws";
import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";
import { broadcastAll } from "./wsManager";

// Constantes de reconnexion
const INITIAL_BACKOFF = 1_000;
const MAX_BACKOFF = 30_000;
const KEEP_ALIVE_MS = 30_000;

// État du module
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let backoff = INITIAL_BACKOFF;
let stopped = true;

/** Construit l'URL WebSocket Jellyfin à partir de la config */
function buildWsUrl(): string | null {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return null;
  return url.replace(/^http/, "ws") + "/socket?api_key=" + encodeURIComponent(apiKey);
}

/** Gère les messages entrants de Jellyfin */
function handleMessage(data: WebSocket.Data): void {
  try {
    const msg = JSON.parse(String(data));
    const type: string = msg.MessageType;
    switch (type) {
      case "LibraryChanged":
        broadcastAll("recently_added");
        broadcastAll("featured");
        break;
      case "UserDataChanged":
        broadcastAll("watchlist");
        broadcastAll("watched");
        break;
      case "PlaybackStart":
      case "PlaybackStopped":
        broadcastAll("continue_watching");
        broadcastAll("next_up");
        break;
      case "ForceKeepAlive":
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ MessageType: "KeepAlive" }));
        }
        break;
    }
  } catch {
    // Message non-JSON ou invalide, ignorer
  }
}

/** Nettoyage des timers et de la connexion */
function cleanup(): void {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) {
    ws.removeAllListeners();
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }
}

/** Planifie une reconnexion avec backoff exponentiel */
function scheduleReconnect(): void {
  if (stopped) return;
  console.log(`[JellyfinWs] Reconnexion dans ${backoff / 1000}s`);
  reconnectTimer = setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF);
}

/** Connexion interne avec gestion de reconnexion */
function connect(): void {
  if (stopped) return;

  const wsUrl = buildWsUrl();
  if (!wsUrl) {
    console.warn("[JellyfinWs] URL ou API key manquante, nouvelle tentative dans 10s");
    reconnectTimer = setTimeout(connect, 10_000);
    return;
  }

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error("[JellyfinWs] Erreur de création:", err);
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    console.log("[JellyfinWs] Connecté à Jellyfin");
    backoff = INITIAL_BACKOFF;

    keepAliveTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ MessageType: "KeepAlive" }));
      }
    }, KEEP_ALIVE_MS);
  });

  ws.on("message", handleMessage);

  ws.on("close", () => {
    if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
    ws = null;
    if (!stopped) scheduleReconnect();
  });

  ws.on("error", (err) => {
    console.error("[JellyfinWs] Erreur:", err.message);
  });
}

// ── API publique ──

export function startJellyfinWs(): void {
  if (!stopped) return;
  stopped = false;
  console.log("[JellyfinWs] Démarrage connexion WebSocket Jellyfin");
  connect();
}

export function stopJellyfinWs(): void {
  stopped = true;
  cleanup();
}

export function restartJellyfinWs(): void {
  console.log("[JellyfinWs] Redémarrage (config modifiée)");
  cleanup();
  backoff = INITIAL_BACKOFF;
  stopped = false;
  setTimeout(connect, 500);
}
