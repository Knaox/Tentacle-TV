import type { WsClientMessage, WsServerMessage } from "@tentacle-tv/shared";
import { recordClockSample } from "./clockSync";

/**
 * Socket Tentacle partagé — UNE connexion WebSocket `/api/ws` par application,
 * multiplexée entre consommateurs (home:update, notifications, Watch Together).
 *
 * Cycle de vie par comptage de références : chaque consommateur appelle
 * `acquireSocket()` (connecte au besoin) et la fonction de release rendue
 * (déconnexion différée quand plus personne n'écoute — absorbe les
 * double-montages StrictMode). Reconnexion backoff 1 s → 30 s ; un échec
 * d'authentification ferme sans reconnexion (statut "authError").
 *
 * Horloge : chaque ping keepalive porte `t = Date.now()` ; le pong du serveur
 * renvoie `t` + `serverTime` (estimation dans `clockSync.ts`). Un premier
 * échantillon part dès l'ouverture, et une cadence dédiée (`setClockSampling`)
 * resserre la mesure le temps d'une séance Watch Together.
 */

export type SocketStatus = "idle" | "connecting" | "open" | "closed" | "authError";

let _wsUrl = "";

/** Set the WebSocket backend URL. Converts http(s):// to ws(s)://.
 *  Une acquisition faite AVANT que l'URL soit connue (au démarrage à froid,
 *  l'accueil monte avant l'effet du fournisseur qui la pose) reste en attente :
 *  la connexion part d'ici dès que l'URL arrive — sinon `connect()` renonçait
 *  en silence et plus rien ne se connectait de toute la vie de l'app (mesuré :
 *  aucun socket après un démarrage à froid sur Android). */
export function setWsBackendUrl(url: string) {
  if (!url && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    _wsUrl = `${proto}//${window.location.host}/api/ws`;
  } else {
    _wsUrl = url.replace(/^http/, "ws").replace(/\/$/, "") + "/api/ws";
  }
  if (refCount > 0 && !ws && !reconnectTimer) connect();
}

const INITIAL_BACKOFF = 1_000;
const MAX_BACKOFF = 30_000;
const PING_INTERVAL = 30_000;
const RELEASE_LINGER_MS = 150;

type MessageListener = (msg: WsServerMessage) => void;
type StatusListener = (status: SocketStatus) => void;

let ws: WebSocket | null = null;
let status: SocketStatus = "idle";
let refCount = 0;
let authToken: string | null | undefined;
let backoff = INITIAL_BACKOFF;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let lingerTimer: ReturnType<typeof setTimeout> | null = null;
let authClosed = false;
/** Cadence d'échantillonnage d'horloge demandée (séance en cours), et son timer. */
let clockCadenceMs: number | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const messageListeners = new Set<MessageListener>();
const statusListeners = new Set<StatusListener>();

function setStatus(s: SocketStatus): void {
  if (status === s) return;
  status = s;
  for (const l of [...statusListeners]) l(s);
}

function dispatch(msg: WsServerMessage): void {
  for (const l of [...messageListeners]) l(msg);
}

function clearTimers(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
}

function handlePong(msg: { t?: number; serverTime?: number }): void {
  if (typeof msg.t !== "number" || typeof msg.serverTime !== "number") return;
  recordClockSample(msg.t, msg.serverTime);
}

/** (Re)pose le timer d'horloge selon la cadence demandée, sur le socket ouvert. */
function armClockTimer(): void {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  if (clockCadenceMs === null || ws?.readyState !== WebSocket.OPEN) return;
  clockTimer = setInterval(() => { sampleClock(); }, clockCadenceMs);
}

function connect(): void {
  if (refCount <= 0 || !_wsUrl || ws) return;
  setStatus("connecting");
  try {
    ws = new WebSocket(_wsUrl);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    if (refCount <= 0) { teardown(); return; }
    backoff = INITIAL_BACKOFF;
    if (authToken && ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "auth", token: authToken }));
    }
    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      }
    }, PING_INTERVAL);
    // Un premier échantillon d'horloge tout de suite : rejoindre une séance en
    // cours calcule sa position de départ avant tout ping keepalive.
    sampleClock();
    armClockTimer();
  };

  ws.onmessage = (event) => {
    let msg: WsServerMessage;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (msg.type === "auth_ok") {
      setStatus("open");
    } else if (msg.type === "auth_error") {
      const reason = (msg as { reason?: string }).reason;
      console.warn("[TentacleSocket] Auth failed:", reason);
      if (reason !== "server_unreachable") {
        authClosed = true;
        ws?.close();
      }
    } else if (msg.type === "pong") {
      handlePong(msg);
    }
    dispatch(msg);
  };

  ws.onclose = () => {
    clearTimers();
    ws = null;
    if (authClosed) {
      authClosed = false;
      setStatus("authError");
      return;
    }
    if (refCount <= 0) {
      setStatus("idle");
      return;
    }
    setStatus("closed");
    scheduleReconnect();
  };

  ws.onerror = () => { /* onclose suit — géré là-bas */ };
}

function scheduleReconnect(): void {
  if (reconnectTimer || refCount <= 0) return;
  const delay = backoff;
  backoff = Math.min(backoff * 2, MAX_BACKOFF);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function teardown(): void {
  clearTimers();
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    if (ws.readyState === WebSocket.OPEN) ws.close();
    ws = null;
  }
  setStatus("idle");
}

/** Prend une référence sur le socket partagé (connecte si nécessaire).
 *  `token` : auth par message (desktop/mobile/TV) ; undefined = cookie (web).
 *  Renvoie la fonction de release (idempotente). */
export function acquireSocket(token?: string | null): () => void {
  if (token != null) authToken = token;
  refCount += 1;
  if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
  // Un précédent échec d'auth ne condamne pas les acquisitions suivantes
  // (nouveau token possible) — on retente.
  if (!ws && (status === "idle" || status === "closed" || status === "authError")) {
    connect();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount -= 1;
    if (refCount > 0) return;
    if (lingerTimer) clearTimeout(lingerTimer);
    lingerTimer = setTimeout(() => {
      lingerTimer = null;
      if (refCount <= 0) teardown();
    }, RELEASE_LINGER_MS);
  };
}

/** Envoie un message (false si le socket n'est pas ouvert). */
export function sendSocketMessage(msg: WsClientMessage): boolean {
  if (ws?.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

/** Abonne aux messages serveur (tous types). Renvoie l'unsubscribe. */
export function subscribeSocket(listener: MessageListener): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

/** Abonne aux changements de statut (appelé immédiatement avec l'état courant). */
export function onSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

export function getSocketStatus(): SocketStatus {
  return status;
}

/** Déclenche un ping horodaté immédiat (rafale d'échantillonnage d'horloge). */
export function sampleClock(): boolean {
  return sendSocketMessage({ type: "ping", t: Date.now() });
}

/** Cadence d'échantillonnage d'horloge (ms) le temps d'une séance — `null`
 *  pour revenir au seul keepalive. Survit aux reconnexions. */
export function setClockSampling(intervalMs: number | null): void {
  clockCadenceMs = intervalMs;
  armClockTimer();
}
