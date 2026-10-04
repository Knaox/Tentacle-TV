import type { FastifyRequest, FastifyReply } from "fastify";
import { getJellyfinUrl } from "../services/configStore";
import { verifyImpersonationToken } from "../services/jwt";
import { jellyfinAuthHeaders, tokenFromAuthHeaders } from "../services/jellyfinAuth";
import { pairedDeviceStatus, PROFILE_ENDED_REPLY, REVOKED_REPLY } from "../services/pairedDeviceStatus";

/**
 * D'où vient la session d'une requête — la Famille en tire ses droits
 * (`family/familyRoutes.ts`) : `personal` = le jeton Jellyfin du web, du
 * bureau, du mobile ; `tvLegacy` = une TV jumelée d'avant les profils ;
 * `tvProfile` = une session de profil d'une TV (Famille) ; `impersonation` =
 * « voir en tant que ». Absent : un appel interne, jamais tenu pour personnel.
 */
export type SessionKind = "personal" | "tvLegacy" | "tvProfile" | "impersonation";

export interface JellyfinUser {
  userId: string;
  username: string;
  isAdmin: boolean;
  session?: SessionKind;
  /** `tvProfile` : le jumelage de la TV dont la session dépend. */
  pairingId?: string;
}

type ValidationResult =
  | { ok: true; user: JellyfinUser }
  /** `revoked` : un jeton d'appareil dont le jumelage n'existe plus — le seul
   *  refus qui autorise un client à se déjumeler ; `profileEnded` : c'était une
   *  session de profil, la TV revient à « Qui regarde ? » sans se déjumeler. */
  | { ok: false; reason: "invalid" | "unreachable"; revoked?: true; profileEnded?: true };

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
      headers: jellyfinAuthHeaders(token),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Seul un refus explicite (401/403) invalide le token. Un 5xx pendant un
      // redémarrage Jellyfin ne doit pas déconnecter les clients → unreachable
      // (503 côté requireAuth, session conservée) avec repli cache stale.
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: "invalid" };
      }
      const stale = tokenCache.get(token);
      if (stale) return { ok: true, user: stale.user };
      return { ok: false, reason: "unreachable" };
    }
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
  // 0. Impersonation JWT (admin naviguant en tant qu'un autre utilisateur).
  //    Vérifié AVANT Jellyfin : check local instantané, et soumettre ce JWT à
  //    Jellyfin renverrait systématiquement 401. isAdmin reste false dans le
  //    payload → aucune route admin accessible pendant l'impersonation.
  const impersonation = await verifyImpersonationToken(token);
  if (impersonation) {
    return {
      ok: true,
      user: { userId: impersonation.userId, username: impersonation.username, isAdmin: false, session: "impersonation" },
    };
  }

  // 1. JWT d'appareil jumelé : tranché ici, sans Jellyfin qui ne le connaît
  //    pas — le même verdict que le proxy, la socket et le rafraîchissement.
  const device = await pairedDeviceStatus(token);
  if (device.status === "paired") {
    const { userId, username, isAdmin, scope, pairingId } = device.payload;
    // Une session de profil n'est JAMAIS administratrice, quoi que dise le jeton.
    if (scope === "profile") return { ok: true, user: { userId, username, isAdmin: false, session: "tvProfile", pairingId } };
    return { ok: true, user: { userId, username, isAdmin, session: "tvLegacy" } };
  }
  if (device.status === "revoked") {
    return device.payload.scope === "profile"
      ? { ok: false, reason: "invalid", revoked: true, profileEnded: true }
      : { ok: false, reason: "invalid", revoked: true };
  }
  if (device.status === "unreachable") return { ok: false, reason: "unreachable" };

  // 2. Jeton Jellyfin (web, bureau, mobile) : la session personnelle.
  const result = await validateJellyfinToken(token);
  return result.ok ? { ok: true, user: { ...result.user, session: "personal" } } : result;
}

/** Le jeton Jellyfin d'un appareil révoqué n'est plus cru sur parole : ni le
 *  cache de validation, ni son repli quand Jellyfin ne répond pas. */
export function forgetValidatedToken(token: string): void {
  tokenCache.delete(token);
}

/** Le refus d'une porte : 503 sans verdict, 401 sinon — avec `revoked` quand
 *  le jumelage n'existe plus. */
function rejection(result: Extract<ValidationResult, { ok: false }>) {
  if (result.reason === "unreachable") return { status: 503, body: { message: "Jellyfin unreachable" } };
  if (result.profileEnded) return { status: 401, body: PROFILE_ENDED_REPLY };
  return { status: 401, body: result.revoked ? REVOKED_REPLY : { message: "Invalid token" } };
}

/** Extract auth token from cookie (web) or Authorization header (mobile/desktop).
 *  Exporté : les routes de téléchargement relisent le token BRUT pour
 *  interroger la policy Jellyfin de l'utilisateur lui-même (Users/Me). */
export function getTokenFromRequest(request: FastifyRequest): string | null {
  // 1. Cookie (web — httpOnly, XSS-proof)
  const cookieToken = (request as any).cookies?.tentacle_token;
  if (cookieToken) return cookieToken;
  // 2. Authorization: Bearer header (mobile/desktop)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  // 3. En-têtes Jellyfin : `X-Emby-Token` des clients anciens, ou le `Token="…"`
  //    d'un en-tête `MediaBrowser` (Authorization ou X-Emby-Authorization).
  return tokenFromAuthHeaders(request.headers) ?? null;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  const result = await validateToken(token);
  if (!result.ok) {
    const { status, body } = rejection(result);
    return reply.status(status).send(body);
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
    const { status, body } = rejection(result);
    return reply.status(status).send(body);
  }

  if (!result.user.isAdmin) {
    return reply.status(403).send({ message: "Forbidden" });
  }

  (request as any).user = result.user;
}
