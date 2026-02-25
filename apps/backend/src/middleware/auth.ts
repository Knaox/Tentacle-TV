import type { FastifyRequest, FastifyReply } from "fastify";
import { getJellyfinUrl } from "../services/configStore";

export interface JellyfinUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

// Token validation cache (TTL 5 min) to avoid hammering Jellyfin on every request
const tokenCache = new Map<string, { user: JellyfinUser; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedUser(token: string): JellyfinUser | null {
  const entry = tokenCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { tokenCache.delete(token); return null; }
  return entry.user;
}

function cacheUser(token: string, user: JellyfinUser): void {
  tokenCache.set(token, { user, expiresAt: Date.now() + CACHE_TTL });
  if (tokenCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of tokenCache) { if (now > v.expiresAt) tokenCache.delete(k); }
  }
}

async function validateJellyfinToken(token: string): Promise<JellyfinUser | null> {
  const cached = getCachedUser(token);
  if (cached) return cached;

  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return null;

  try {
    const res = await fetch(`${jellyfinUrl}/Users/Me`, {
      headers: { "X-Emby-Token": token },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user: JellyfinUser = {
      userId: data.Id,
      username: data.Name,
      isAdmin: data.Policy?.IsAdministrator === true,
    };
    cacheUser(token, user);
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
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

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
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
