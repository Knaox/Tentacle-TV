import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { validateToken, type JellyfinUser } from "../middleware/auth";
import { addConnection, removeConnection } from "../services/wsManager";
import { hashToken } from "../services/jwt";
import { handleWtMessage } from "../services/watchTogether/gateway";

const AUTH_TIMEOUT_MS = 15_000;
const PING_INTERVAL_MS = 30_000;

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
 *  Together) et dispatch des messages métier `wt:*` (authentifiés uniquement). */
function handleParsedMessage(
  socket: WebSocket,
  msg: WsClientMessage,
  getUser: () => JellyfinUser | null,
): void {
  if (msg.type === "ping") {
    const echo = typeof msg.t === "number" ? { t: msg.t } : {};
    socket.send(JSON.stringify({ type: "pong", ...echo, serverTime: Date.now() }));
    return;
  }
  if (msg.type.startsWith("wt:")) {
    const user = getUser();
    if (user) handleWtMessage(user, msg, socket);
    return;
  }
}

function setupPing(ws: WebSocket): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (ws.readyState === 1) ws.ping();
  }, PING_INTERVAL_MS);
}

interface BoundSession {
  user: JellyfinUser;
  /** sha256 du token — clé de ciblage pour la révocation d'appareil. */
  tokenHash: string;
}

async function authenticateAndBind(
  ws: WebSocket,
  token: string,
): Promise<BoundSession | null> {
  const result = await validateToken(token);
  if (!result.ok) {
    if (result.reason === "unreachable") {
      ws.send(JSON.stringify({ type: "auth_error", reason: "server_unreachable" }));
      ws.close(4003, "Server unreachable");
    } else {
      ws.send(JSON.stringify({ type: "auth_error", reason: "invalid_token" }));
      ws.close(4001, "Authentication failed");
    }
    return null;
  }

  const tokenHash = hashToken(token);
  ws.send(JSON.stringify({ type: "auth_ok" }));
  addConnection(result.user.userId, ws, tokenHash);
  return { user: result.user, tokenHash };
}

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    let user: JellyfinUser | null = null;
    let tokenHash: string | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (user) removeConnection(user.userId, socket, tokenHash ?? undefined);
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);

    // 1. Try cookie auth first (web clients — cookie sent on upgrade)
    const cookies = (request as unknown as { cookies?: Record<string, string> }).cookies;
    // Fallback: parse cookie manually from raw header if @fastify/cookie didn't run
    let cookieToken = cookies?.tentacle_token;
    if (!cookieToken && request.headers.cookie) {
      const match = request.headers.cookie.match(/(?:^|;\s*)tentacle_token=([^;]*)/);
      if (match) cookieToken = decodeURIComponent(match[1]);
    }

    if (cookieToken) {
      authenticateAndBind(socket, cookieToken).then((u) => {
        if (u) {
          user = u.user;
          tokenHash = u.tokenHash;
          pingInterval = setupPing(socket);
        }
      });

      // Ping keepalive + messages métier des clients cookie-authentifiés
      socket.on("message", (raw: Buffer) => {
        const msg = tryParseMessage(String(raw));
        if (msg) handleParsedMessage(socket, msg, () => user);
      });
      return;
    }

    // 2. Wait for auth message (mobile/TV/desktop)
    const authTimeout = setTimeout(() => {
      if (!user) {
        socket.send(JSON.stringify({ type: "auth_error", reason: "timeout" }));
        socket.close(4001, "Auth timeout");
      }
    }, AUTH_TIMEOUT_MS);

    socket.on("message", (raw: Buffer) => {
      const msg = tryParseMessage(String(raw));
      if (!msg) return;

      if (msg.type === "auth" && !user && typeof msg.token === "string") {
        clearTimeout(authTimeout);
        authenticateAndBind(socket, msg.token).then((u) => {
          if (u) {
            user = u.user;
            tokenHash = u.tokenHash;
            pingInterval = setupPing(socket);
          }
        });
        return;
      }

      handleParsedMessage(socket, msg, () => user);
    });
  });
};
