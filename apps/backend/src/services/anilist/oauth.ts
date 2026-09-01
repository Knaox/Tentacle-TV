import crypto from "crypto";
import { getPrisma } from "../db";
import { getConfigValue, getPublicUrl } from "../configStore";
import { decryptSecret, encryptSecret } from "../crypto";
import { AniListError, fetchViewer } from "./client";

/**
 * OAuth2 AniList — une app déclarée PAR INSTANCE (même modèle que la clé
 * TMDB) : l'admin crée son client AniList avec l'URL publique du serveur en
 * redirection et saisit `anilist_client_id` / `anilist_client_secret`.
 * Le jeton (longue durée) est chiffré au repos (services/crypto).
 */

const AUTHORIZE_URL = "https://anilist.co/api/v2/oauth/authorize";
const TOKEN_URL = "https://anilist.co/api/v2/oauth/token";

export function anilistClientId(): string | undefined {
  return process.env.ANILIST_CLIENT_ID || getConfigValue("anilist_client_id") || undefined;
}

function anilistClientSecret(): string | undefined {
  return process.env.ANILIST_CLIENT_SECRET || getConfigValue("anilist_client_secret") || undefined;
}

export function anilistAvailable(): boolean {
  return !!anilistClientId() && !!anilistClientSecret() && !!getPublicUrl();
}

export function redirectUri(): string | null {
  const base = getPublicUrl();
  return base ? `${base}/api/external/anilist/callback` : null;
}

// Le `state` OAuth relie le retour d'AniList au compte qui a cliqué « Lier » :
// jeton aléatoire à usage unique, 10 minutes, en mémoire (un seul process).
const pendingStates = new Map<string, { userId: string; expiresAt: number }>();
const STATE_TTL_MS = 10 * 60_000;

export function createOAuthState(userId: string): string {
  for (const [key, value] of pendingStates) {
    if (value.expiresAt < Date.now()) pendingStates.delete(key);
  }
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.set(state, { userId, expiresAt: Date.now() + STATE_TTL_MS });
  return state;
}

export function consumeOAuthState(state: string): string | null {
  const entry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

export function buildAuthorizeUrl(state: string): string | null {
  const clientId = anilistClientId();
  const redirect = redirectUri();
  if (!clientId || !redirect) return null;
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    state,
  });
  return `${AUTHORIZE_URL}?${q.toString()}`;
}

/** Échange le code, vérifie le jeton (Viewer) et stocke le compte chiffré. */
export async function completeOAuth(userId: string, code: string): Promise<{ name: string }> {
  const clientId = anilistClientId();
  const clientSecret = anilistClientSecret();
  const redirect = redirectUri();
  if (!clientId || !clientSecret || !redirect) {
    throw new AniListError("AniList non configuré", 0);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      code,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !body?.access_token) {
    throw new AniListError(`Échange OAuth refusé (${res.status})`, res.status);
  }

  const viewer = await fetchViewer(body.access_token);
  const prisma = getPrisma();
  const encrypted = await encryptSecret(body.access_token);
  await prisma.externalAccount.upsert({
    where: { jellyfinUserId_provider: { jellyfinUserId: userId, provider: "anilist" } },
    create: {
      jellyfinUserId: userId,
      provider: "anilist",
      externalId: String(viewer.id),
      accessToken: encrypted,
    },
    update: { externalId: String(viewer.id), accessToken: encrypted, createdAt: new Date() },
  });
  return { name: viewer.name };
}

/** Le jeton déchiffré du compte, ou null (non lié / chiffré illisible). */
export async function anilistTokenFor(userId: string): Promise<string | null> {
  const prisma = getPrisma();
  const row = await prisma.externalAccount.findUnique({
    where: { jellyfinUserId_provider: { jellyfinUserId: userId, provider: "anilist" } },
  });
  if (!row?.accessToken) return null;
  return decryptSecret(row.accessToken);
}
