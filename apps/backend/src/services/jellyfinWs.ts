import WebSocket from "ws";
import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";
import { broadcastAll } from "./wsManager";
import { poke as pokeLibraryAdded } from "./libraryAddedNotifier";
import { pokeWatchTime } from "./watchTime/collector";
import { pokeProfile } from "./reco/jobs";
import { sessionSignatures } from "./jellyfinWsSessions";

/**
 * Le WebSocket Jellyfin — ce qu'il livre vraiment, et à quelles conditions.
 *
 * Mesuré sur Jellyfin 10.11.8, connexion par `?api_key=` (la nôtre) :
 *
 *  1. **Sans abonnement, la socket est MUETTE.** Dix minutes d'écoute, deux
 *     lectures en cours sur le serveur : zéro message, hormis le
 *     `ForceKeepAlive` d'accueil. Les événements poussés par Jellyfin
 *     (`LibraryChanged`, `UserDataChanged`, `PlaybackStart`…) partent vers des
 *     SESSIONS UTILISATEUR ; une clé d'API n'en ouvre aucune, donc rien
 *     n'arrive. Les branches correspondantes du gestionnaire ci-dessous ne
 *     coûtent rien et servent de filet si la connexion venait un jour d'un
 *     jeton utilisateur — mais elles ne se déclenchent pas aujourd'hui.
 *  2. **`SessionsStart` fonctionne**, lui, et c'est le seul canal qui parle à
 *     une clé d'API. Jellyfin IGNORE la période demandée : il pousse à chaque
 *     progression de lecture (~18 trames/min à deux lectures, ~20 Ko la trame).
 *     D'où le filtrage par signature — voir `jellyfinWsSessions.ts`.
 *  3. **`LibraryChangedStart` TUE la connexion** : fermeture immédiate, code
 *     1000, raison « System Shutdown ». Ce type de message n'existe pas dans
 *     l'énumération du serveur et la désérialisation emporte la socket avec
 *     elle. Ne JAMAIS envoyer un type de message inconnu ici : les additions
 *     de bibliothèque se détectent par sondage (`libraryAddedNotifier`), pas
 *     par abonnement.
 *  4. `ForceKeepAlive` annonce `Data: 60` — soixante secondes sans un mot du
 *     client et le serveur ferme. On répond toutes les 30 s.
 */

// Constantes de reconnexion
const INITIAL_BACKOFF = 1_000;
const MAX_BACKOFF = 30_000;
const KEEP_ALIVE_MS = 30_000;

/** Jellyfin répond à CHAQUE KeepAlive : trois silences d'affilée = socket morte. */
const SILENCE_MAX_MS = 95_000;
const WATCHDOG_MS = 15_000;

/** Au-delà, on ne considère plus que le WebSocket couvre les sessions. */
const SESSIONS_FRESH_MS = 120_000;

// État du module
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let backoff = INITIAL_BACKOFF;
let stopped = true;
let wsConnected = false;

/** Génération de la socket courante. Une socket périmée (remplacée par un
 *  redémarrage de config pendant qu'elle se fermait) ne doit plus rien piloter :
 *  sans ce garde, son `close` planifiait une reconnexion PAR-DESSUS la socket
 *  vivante, et deux sockets se disputaient l'état du module. */
let generation = 0;

let lastMessageMs = 0;
let lastSessionsFrameMs = 0;
let playingSignature = "";
let statesSignature = "";
/** La toute première trame sert d'empreinte de départ, pas de nouvelle. */
let sessionsPrimed = false;

/** Le WebSocket tient-il vraiment le direct des sessions ?
 *
 *  Ancien nom : `isJellyfinWsConnected`. « Connecté » ne voulait rien dire :
 *  une socket ouverte et muette suffisait à endormir le poller de secours, et
 *  l'application restait figée sans que rien ne le signale. La question utile
 *  est « livre-t-il ? », pas « est-il branché ? ». */
export function sessionsLive(): boolean {
  return wsConnected && Date.now() - lastSessionsFrameMs < SESSIONS_FRESH_MS;
}

/** Construit l'URL WebSocket Jellyfin à partir de la config */
function buildWsUrl(): string | null {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return null;
  return url.replace(/^http/, "ws") + "/socket?api_key=" + encodeURIComponent(apiKey);
}

/** Trame `Sessions` : ne réveiller la maison que sur un vrai changement. */
function handleSessions(data: unknown): void {
  lastSessionsFrameMs = Date.now();
  const { playing, states } = sessionSignatures(data as never);

  const segmentEdge = states !== statesSignature;
  const listsMoved = playing !== playingSignature;
  statesSignature = states;
  playingSignature = playing;

  // Première trame de la vie du processus : elle décrit l'état que les clients
  // ont déjà reçu en se connectant. La diffuser ferait re-piocher toute la
  // maison au démarrage du serveur, pour rien. Les trames suivantes — y compris
  // la première d'APRÈS une reconnexion — sont comparées normalement : une
  // lecture démarrée pendant la coupure doit se voir.
  if (!sessionsPrimed) { sessionsPrimed = true; return; }

  // Début, fin, pause, reprise : autant de bords de segment pour la mesure.
  if (segmentEdge) pokeWatchTime();
  if (listsMoved) {
    broadcastAll("continue_watching");
    broadcastAll("next_up");
  }
}

/** Gère les messages entrants de Jellyfin */
function handleMessage(data: WebSocket.Data): void {
  lastMessageMs = Date.now();
  try {
    const msg = JSON.parse(String(data));
    const type: string = msg.MessageType;
    switch (type) {
      case "Sessions":
        handleSessions(msg.Data);
        break;
      case "LibraryChanged":
        broadcastAll("recently_added");
        broadcastAll("featured");
        // Accélère la détection + fournit les IDs exacts des ajouts (pour titrer
        // la notif, même si la date n'est pas fiable). Poll aussi périodiquement.
        pokeLibraryAdded(msg?.Data?.ItemsAdded);
        break;
      case "UserDataChanged":
        broadcastAll("watchlist");
        broadcastAll("watched");
        // Un favori posé, un titre terminé… : le profil de goût de CE compte
        // se reconstruit (débouncé 8 s côté jobs — une salve ne coûte qu'un
        // rebuild).
        pokeProfile(msg?.Data?.UserId);
        break;
      case "PlaybackStart":
      case "PlaybackStopped":
        broadcastAll("continue_watching");
        broadcastAll("next_up");
        pokeWatchTime();
        break;
      // Le contenu de ces messages n'est JAMAIS lu : ils ne servent que de
      // sonnette au collecteur, qui va relever les sessions lui-même. Une
      // mesure ne doit pas dépendre d'une source qui peut mentir ou manquer.
      case "PlaybackProgress":
        pokeWatchTime();
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

function stopTimers(): void {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
}

/** Nettoyage des timers et de la connexion */
function cleanup(): void {
  stopTimers();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  generation++; // Ce qui tenait la génération précédente ne pilote plus rien.
  if (ws) {
    ws.removeAllListeners();
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }
  wsConnected = false;
  lastSessionsFrameMs = 0;
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

  const mine = ++generation;
  const isMine = () => mine === generation;

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    console.error("[JellyfinWs] Erreur de création:", err);
    scheduleReconnect();
    return;
  }

  const socket = ws;

  socket.on("open", () => {
    if (!isMine()) return;
    console.log("[JellyfinWs] Connecté à Jellyfin");
    backoff = INITIAL_BACKOFF;
    wsConnected = true;
    lastMessageMs = Date.now();

    // Sans cet abonnement, la socket ne dit RIEN (cf. l'en-tête du fichier).
    // La période est une politesse : Jellyfin pousse sur événement de lecture.
    socket.send(JSON.stringify({ MessageType: "SessionsStart", Data: "0,10000" }));

    keepAliveTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ MessageType: "KeepAlive" }));
        // Doublure au niveau du protocole : Jellyfin répond à nos KeepAlive
        // applicatifs (mesuré en 10.11), mais le `pong` est dû par TOUTE
        // implémentation. Le guet ci-dessous ne dépend donc pas de la version
        // d'en face — sans quoi un serveur muet le ferait rouvrir en boucle.
        socket.ping();
      }
    }, KEEP_ALIVE_MS);

    // Une socket à moitié morte (TCP coupé sans FIN — veille de la machine,
    // table NAT vidée) reste OPEN pour toujours : les KeepAlive partent dans le
    // vide, aucun `close` n'arrive, et le poller se croit couvert. Le silence
    // est le seul symptôme observable, on l'observe.
    watchdogTimer = setInterval(() => {
      if (!isMine()) return;
      if (Date.now() - lastMessageMs < SILENCE_MAX_MS) return;
      console.warn("[JellyfinWs] Silence de plus de 95 s — socket réputée morte, on rouvre");
      stopTimers();
      socket.terminate();
    }, WATCHDOG_MS);
  });

  socket.on("message", (data) => { if (isMine()) handleMessage(data); });

  // Signe de vie protocolaire : il compte comme un message pour le guet.
  socket.on("pong", () => { if (isMine()) lastMessageMs = Date.now(); });

  socket.on("close", () => {
    if (!isMine()) return;
    stopTimers();
    wsConnected = false;
    lastSessionsFrameMs = 0;
    ws = null;
    if (!stopped) scheduleReconnect();
  });

  socket.on("error", (err) => {
    if (isMine()) console.error("[JellyfinWs] Erreur:", err.message);
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
