import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { validateToken, type JellyfinUser } from "../middleware/auth";
import { addConnection, removeConnection } from "../services/wsManager";

const AUTH_TIMEOUT_MS = 15_000;
const PING_INTERVAL_MS = 30_000;

interface WsClientMessage {
  type: string;
  token?: string;
}

function tryParseMessage(raw: string): WsClientMessage | null {
  try {
    const msg = JSON.parse(raw);
    if (msg && typeof msg.type === "string") return msg as WsClientMessage;
    return null;
  } catch {
    return null;
  }
}

function setupPing(ws: WebSocket): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (ws.readyState === 1) ws.ping();
  }, PING_INTERVAL_MS);
}

async function authenticateAndBind(
  ws: WebSocket,
  token: string,
): Promise<JellyfinUser | null> {
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

  ws.send(JSON.stringify({ type: "auth_ok" }));
  addConnection(result.user.userId, ws);
  return result.user;
}

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    let user: JellyfinUser | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (user) removeConnection(user.userId, socket);
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
          user = u;
          pingInterval = setupPing(socket);
        }
      });

      // Still listen for ping messages from cookie-authed clients
      socket.on("message", (raw: Buffer) => {
        const msg = tryParseMessage(String(raw));
        if (msg?.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
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

      if (msg.type === "auth" && !user && msg.token) {
        clearTimeout(authTimeout);
        authenticateAndBind(socket, msg.token).then((u) => {
          if (u) {
            user = u;
            pingInterval = setupPing(socket);
          }
        });
        return;
      }

      if (msg.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
      }
    });
  });
};
