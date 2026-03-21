import type { FastifyRequest, FastifyReply } from "fastify";
import { getJellyfinUrl } from "../services/configStore";
import { verifyDeviceToken, hashToken } from "../services/jwt";
import { getPrisma, hasPrisma } from "../services/db";

export interface JellyfinUser {
  userId: string;
  username: string;
  isAdmin: boolean;
}

type ValidationResult =
  | { ok: true; user: JellyfinUser }
  | { ok: false; reason: "invalid" | "unreachable" };

// Token validation cache (TTL 5 min) to avoid hammering Jellyfin on every request
const tokenCache = new Map<string, { user: JellyfinUser; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedUser(token: string): JellyfinUser | null {
  const entry = tokenCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null; // Expired but keep entry for stale fallback
  return entry.user;
}

function cacheUser(token: string, user: JellyfinUser): void {
  tokenCache.set(token, { user, expiresAt: Date.now() + CACHE_TTL });
  if (tokenCache.size > 500) {
    const now = Date.now();
    // Only prune entries older than 1h (keep stale entries for fallback)
    for (const [k, v] of tokenCache) { if (now - v.expiresAt > 3600_000) tokenCache.delete(k); }
  }
}

async function validateJellyfinToken(token: string): Promise<ValidationResult> {
  const cached = getCachedUser(token);
  if (cached) return { ok: true, user: cached };

  const jellyfinUrl = getJellyfinUrl();
  if (!jellyfinUrl) return { ok: false, reason: "unreachable" };

  try {
    const res = await fetch(`${jellyfinUrl}/Users/Me`, {
      headers: { "X-Emby-Token": token },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, reason: "invalid" };
    const data = await res.json();
    const user: JellyfinUser = {
      userId: data.Id,
      username: data.Name,
      isAdmin: data.Policy?.IsAdministrator === true,
    };
    cacheUser(token, user);
    return { ok: true, user };
  } catch {
    // Network error / timeout — try stale cache before giving up
    const stale = tokenCache.get(token);
    if (stale) return { ok: true, user: stale.user };
    return { ok: false, reason: "unreachable" };
  }
}

export async function validateToken(token: string): Promise<ValidationResult> {
  // 1. Try Jellyfin token first (most common path)
  const jfResult = await validateJellyfinToken(token);
  if (jfResult.ok) return jfResult;

  // 2. Try custom JWT (paired device tokens)
  const payload = await verifyDeviceToken(token);
  if (!payload) return jfResult; // Preserve original reason (invalid vs unreachable)

  // 3. Verify device hasn't been revoked
  if (!hasPrisma()) return { ok: false, reason: "unreachable" };
  try {
    const prisma = getPrisma();
    const hash = hashToken(token);
    const device = await prisma.pairedDevice.findUnique({ where: { tokenHash: hash } });
    if (!device) return { ok: false, reason: "invalid" };

    // Update lastSeen (fire and forget)
    prisma.pairedDevice
      .update({ where: { id: device.id }, data: { lastSeen: new Date() } })
      .catch(() => {});

    return {
      ok: true,
      user: { userId: payload.userId, username: payload.username, isAdmin: payload.isAdmin },
    };
  } catch {
    return { ok: false, reason: "unreachable" };
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

  const result = await validateToken(token);
  if (!result.ok) {
    const status = result.reason === "unreachable" ? 503 : 401;
    const message = result.reason === "unreachable" ? "Jellyfin unreachable" : "Invalid token";
    return reply.status(status).send({ message });
  }

  (request as any).user = result.user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const result = await validateToken(token);
  if (!result.ok) {
    const status = result.reason === "unreachable" ? 503 : 401;
    const message = result.reason === "unreachable" ? "Jellyfin unreachable" : "Invalid token";
    return reply.status(status).send({ message });
  }

  if (!result.user.isAdmin) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  (request as any).user = result.user;
}
