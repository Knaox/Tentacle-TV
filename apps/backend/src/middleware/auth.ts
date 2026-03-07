import type { FastifyRequest, FastifyReply } from "fastify";
import { getJellyfinUrl } from "../services/configStore";
import { verifyDeviceToken, hashToken } from "../services/jwt";
import { getPrisma, hasPrisma } from "../services/db";

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

async function validateToken(token: string): Promise<JellyfinUser | null> {
  // 1. Try Jellyfin token first (most common path)
  const jellyfinUser = await validateJellyfinToken(token);
  if (jellyfinUser) return jellyfinUser;

  // 2. Try custom JWT (paired device tokens)
  const payload = await verifyDeviceToken(token);
  if (!payload) return null;

  // 3. Verify device hasn't been revoked
  if (!hasPrisma()) return null;
  try {
    const prisma = getPrisma();
    const hash = hashToken(token);
    const device = await prisma.pairedDevice.findUnique({ where: { tokenHash: hash } });
    if (!device) return null;

    // Update lastSeen (fire and forget)
    prisma.pairedDevice
      .update({ where: { id: device.id }, data: { lastSeen: new Date() } })
      .catch(() => {});

    return {
      userId: payload.userId,
      username: payload.username,
      isAdmin: payload.isAdmin,
    };
  } catch {
    return null;
  }
}

/** Extract auth token from cookie (web) or Authorization header (mobile/desktop). */
function getTokenFromRequest(request: FastifyRequest): string | null {
  // 1. Cookie (web — httpOnly, XSS-proof)
  const cookieToken = (request as any).cookies?.tentacle_token;
  if (cookieToken) return cookieToken;
  // 2. Authorization: Bearer header (mobile/desktop)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  // 3. X-Emby-Token header (Jellyfin client direct)
  const embyToken = request.headers["x-emby-token"];
  if (typeof embyToken === "string" && embyToken) return embyToken;
  return null;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const user = await validateToken(token);
  if (!user) {
    return reply.status(401).send({ message: "Invalid token" });
  }

  (request as any).user = user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const user = await validateToken(token);
  if (!user) {
    return reply.status(401).send({ message: "Invalid token" });
  }

  if (!user.isAdmin) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  (request as any).user = user;
}
