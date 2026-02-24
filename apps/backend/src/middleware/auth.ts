import type { FastifyRequest, FastifyReply } from "fastify";

const JELLYFIN_URL = (process.env.JELLYFIN_URL || "http://localhost:8096").replace(/\/$/, "");

export interface JellyfinUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

/**
 * Validate a Jellyfin access token by calling /Users/Me.
 * Returns user info if valid, null otherwise.
 */
async function validateJellyfinToken(token: string): Promise<JellyfinUser | null> {
  try {
    const res = await fetch(`${JELLYFIN_URL}/Users/Me`, {
      headers: { "X-Emby-Token": token },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return {
      userId: user.Id,
      username: user.Name,
      isAdmin: user.Policy?.IsAdministrator === true,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  const user = await validateJellyfinToken(token);
  if (!user) {
    return reply.status(401).send({ message: "Invalid token" });
  }

  (request as any).user = user;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  const user = await validateJellyfinToken(token);
  if (!user) {
    return reply.status(401).send({ message: "Invalid token" });
  }

  if (!user.isAdmin) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  (request as any).user = user;
}
