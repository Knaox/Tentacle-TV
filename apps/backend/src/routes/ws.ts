import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import type { JellyfinUser } from "../middleware/auth";
import { removeConnection } from "../services/wsManager";
import { handleSocketClosed, handleWtMessage } from "../services/watchTogether/gateway";
import {
  handleSessionClosed,
  handleSessionMessage,
  type ChannelConnection,
} from "../services/deviceSessions/gateway";
import { isSessionMessageType } from "../services/deviceSessions/protocolParse";
import { canUseWatchTogether } from "../services/family/profileSessionLimits";
import { cookieDecidesAtOnce } from "../services/sessionTokenChoice";
import { authenticateAndBind, type BoundSession } from "./wsSessionAuth";
import { createSocketAnnouncement } from "./wsAnnouncement";

/** Ping protocolaire toutes les 10 s ; deux pongs manqués = socket mort,
 *  fermé d'office — une séance ne doit pas attendre un lecteur disparu
 *  jusqu'à ce que TCP s'en aperçoive. */
const PING_INTERVAL_MS = 10_000;

type WsClientMessage = { type: string; token?: string } & Record<string, unknown>;

function tryParseMessage(raw: string): WsClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (msg && typeof msg.type === "string") return msg as WsClientMessage;
    return null;
  } catch {
    return null;
  }
}

/** Messages communs aux deux modes d'auth (cookie et message) : ping keepalive
 *  (pong horodaté — echo `t` + `serverTime` pour l'offset d'horloge Watch
 *  Together), dispatch des messages métier `wt:*` et du canal de session
 *  `session:*` / `playback:*` (authentifiés uniquement). */
function handleParsedMessage(
  socket: WebSocket,
  msg: WsClientMessage,
  getUser: () => JellyfinUser | null,
  getChannel: () => BoundChannel | null,
): void {
  if (msg.type === "ping") {
    const echo = typeof msg.t === "number" ? { t: msg.t } : {};
    socket.send(JSON.stringify({ type: "pong", ...echo, serverTime: Date.now() }));
    return;
  }
  if (msg.type.startsWith("wt:")) {
    const user = getUser();
    // Un profil invité de la Famille n'a pas Watch Together (il n'apparaît dans aucune liste).
    if (user?.session === "tvProfile") {
      void canUseWatchTogether(user).then((allowed) => {
        if (allowed) handleWtMessage(user, msg, socket);
      });
    } else if (user) {
      handleWtMessage(user, msg, socket);
    }
    return;
  }
  if (isSessionMessageType(msg.type)) {
    const bound = getChannel();
    if (bound) handleSessionMessage(bound.channel, bound.token, msg);
  }
}

/** La connexion vue par le canal de session, et le jeton qui l'a ouverte. */
interface BoundChannel {
  channel: ChannelConnection;
  token: string;
}

function bindChannel(socket: WebSocket, user: JellyfinUser, token: string): BoundChannel {
  return {
    token,
    channel: {
      userId: user.userId,
      username: user.username,
      send: (message) => {
        if (socket.readyState === 1 /* OPEN */) socket.send(JSON.stringify(message));
      },
    },
  };
}

function setupPing(ws: WebSocket): ReturnType<typeof setInterval> {
  let alive = true;
  ws.on("pong", () => { alive = true; });
  return setInterval(() => {
    if (ws.readyState !== 1) return;
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
  }, PING_INTERVAL_MS);
}

/** Le cookie de session de la poignée de main (web ; le pot d'une app native aussi). */
function sessionCookieOf(request: FastifyRequest): string | undefined {
  const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies;
  // Fallback: parse cookie manually from raw header if @fastify/cookie didn't run
  let cookieToken = cookies?.tentacle_token;
  if (!cookieToken && request.headers.cookie) {
    const match = request.headers.cookie.match(/(?:^|;\s*)tentacle_token=([^;]*)/);
    if (match) cookieToken = decodeURIComponent(match[1]);
  }
  return cookieToken || undefined;
}

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    let user: JellyfinUser | null = null;
    let tokenHash: string | null = null;
    let bound: BoundChannel | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    /** La socket parle au nom de cette session. Fermée pendant la vérification :
     *  elle n'est pas gardée parmi les connexions du compte (présence fausse). */
    const adopt = (session: BoundSession) => {
      if (closed) {
        removeConnection(session.user.userId, socket, session.tokenHash);
        return;
      }
      user = session.user;
      tokenHash = session.tokenHash;
      bound = bindChannel(socket, session.user, session.token);
      pingInterval = setupPing(socket);
    };
    /** Plus de session : socket fermée, ou une session en remplace une autre. */
    const release = () => {
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
      if (bound) {
        handleSessionClosed(bound.channel);
        bound = null;
      }
      if (user) {
        handleSocketClosed(user.userId, socket);
        removeConnection(user.userId, socket, tokenHash ?? undefined);
        user = null;
        tokenHash = null;
      }
    };

    // 1. Le cookie d'un navigateur (la page web, cookie envoyé à la poignée
    //    de main), ou une session que le serveur y a posée : il décide aussitôt.
    const cookieToken = sessionCookieOf(request);
    if (cookieToken && cookieDecidesAtOnce(cookieToken, request.headers)) {
      const cleanup = () => { closed = true; release(); };
      socket.on("close", cleanup);
      socket.on("error", cleanup);
      authenticateAndBind(socket, cookieToken).then((session) => { if (session) adopt(session); });
      // Ping keepalive + messages métier des clients cookie-authentifiés
      socket.on("message", (raw: Buffer) => {
        const msg = tryParseMessage(String(raw));
        if (msg) handleParsedMessage(socket, msg, () => user, () => bound);
      });
      return;
    }

    // 2. Le message `auth` (mobile, TV, bureau). Le cookie de connexion qu'une
    //    app native garde dans son pot n'est qu'un repli : son message l'emporte.
    const announcement = createSocketAnnouncement({ socket, cookie: cookieToken, adopt, release });
    const cleanup = () => {
      closed = true;
      announcement.dispose();
      release();
    };
    socket.on("close", cleanup);
    socket.on("error", cleanup);

    socket.on("message", (raw: Buffer) => {
      const msg = tryParseMessage(String(raw));
      if (!msg) return;
      if (msg.type === "auth") {
        if (typeof msg.token === "string") announcement.announce(msg.token);
        return;
      }
      handleParsedMessage(socket, msg, () => user, () => bound);
    });
  });
};
