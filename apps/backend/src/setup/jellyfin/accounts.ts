import { randomBytes } from "crypto";
import { jellyfinTokenAuth } from "../../services/jellyfinAuth";
import { buildAuthHeader, deviceIdFor } from "../../services/jellyfinIdentity";
import { SetupError } from "../setupErrors";
import { jellyfinRequest } from "./guardedFetch";

/**
 * Les comptes et la clé d'API. Le mot de passe ne fait que passer : jamais
 * stocké, jamais journalisé. La clé « Tentacle » ne quitte le serveur que vers
 * Jellyfin — ni réponse au client, ni journal.
 */
export const TENTACLE_KEY_APP = "Tentacle";

// Sans base (rare : la clé d'installation n'existe pas encore), un appareil
// propre à ce processus plutôt qu'une constante partagée par tous les serveurs.
const FALLBACK_DEVICE_ID = `tentacle-setup-${randomBytes(6).toString("hex")}`;

/** L'en-tête `MediaBrowser` de l'assistant, avec le jeton d'une session de compte s'il y en a un. */
export async function setupAuthorization(token?: string): Promise<string> {
  const deviceId = await deviceIdFor("setup").catch(() => FALLBACK_DEVICE_ID);
  return buildAuthHeader({ device: "Setup", deviceId, token });
}

export interface JellyfinAccount {
  id: string;
  name: string;
  isAdmin: boolean;
  /** La session ouverte pour l'assistant ; refermée par `signOut` une fois servie. */
  token: string;
}

interface AuthResult {
  AccessToken?: unknown;
  User?: { Id?: unknown; Name?: unknown; Policy?: { IsAdministrator?: unknown } };
}

export async function authenticate(url: string, username: string, password: string): Promise<JellyfinAccount> {
  const reply = await jellyfinRequest(url, "/Users/AuthenticateByName", {
    method: "POST",
    body: { Username: username, Pw: password },
    authorization: await setupAuthorization(),
    timeoutMs: 15_000,
  });
  if (reply.status >= 500) throw new SetupError("jf_unreachable");
  if (reply.status !== 200) throw new SetupError("jf_bad_credentials");
  const data = reply.json as AuthResult | null;
  const token = data?.AccessToken;
  const id = data?.User?.Id;
  if (typeof token !== "string" || typeof id !== "string") throw new SetupError("jf_not_jellyfin");
  return {
    id,
    name: typeof data?.User?.Name === "string" ? data.User.Name : username,
    isAdmin: data?.User?.Policy?.IsAdministrator === true,
    token,
  };
}

/** Referme la session de l'assistant : pas d'appareil « Setup » qui traîne dans Jellyfin. */
export async function signOut(url: string, token: string): Promise<void> {
  await jellyfinRequest(url, "/Sessions/Logout", { method: "POST", authorization: await setupAuthorization(token) }).catch(() => undefined);
}

interface KeyEntry {
  token: string;
  app: string;
}

async function listKeys(url: string, authorization: string): Promise<KeyEntry[]> {
  const reply = await jellyfinRequest(url, "/Auth/Keys", { authorization, maxBytes: 1024 * 1024 });
  if (reply.status === 401 || reply.status === 403) throw new SetupError("jf_not_admin");
  if (reply.status !== 200) throw new SetupError("jf_api_key_failed");
  const items = (reply.json as { Items?: unknown } | null)?.Items;
  if (!Array.isArray(items)) throw new SetupError("jf_api_key_failed");
  return items.flatMap((item: { AccessToken?: unknown; AppName?: unknown }) =>
    typeof item?.AccessToken === "string" ? [{ token: item.AccessToken, app: typeof item.AppName === "string" ? item.AppName : "" }] : [],
  );
}

/**
 * Crée la clé « Tentacle » au nom d'un administrateur, et la retrouve :
 * Jellyfin ne la rend pas à la création (204). La NOUVELLE est celle qui
 * n'existait pas juste avant — une autre clé « Tentacle » (un second serveur
 * sur le même Jellyfin) n'est jamais prise pour la nôtre.
 */
export async function createTentacleKey(url: string, adminToken: string): Promise<string> {
  const authorization = await setupAuthorization(adminToken);
  const before = new Set((await listKeys(url, authorization)).map((key) => key.token));
  const created = await jellyfinRequest(url, "/Auth/Keys", { method: "POST", query: { app: TENTACLE_KEY_APP }, authorization });
  if (created.status === 401 || created.status === 403) throw new SetupError("jf_not_admin");
  if (created.status < 200 || created.status >= 300) throw new SetupError("jf_api_key_failed");
  const fresh = (await listKeys(url, authorization)).filter((key) => key.app === TENTACLE_KEY_APP && !before.has(key.token));
  if (fresh.length !== 1) throw new SetupError("jf_api_key_failed");
  return fresh[0].token;
}

/** Une clé collée doit ouvrir les routes d'administration (`/Auth/Keys` l'exige). */
export async function verifyApiKey(url: string, key: string): Promise<void> {
  const reply = await jellyfinRequest(url, "/Auth/Keys", { authorization: jellyfinTokenAuth(key), maxBytes: 1024 * 1024 });
  if (reply.status === 401 || reply.status === 403) throw new SetupError("jf_api_key_invalid");
  if (reply.status !== 200) throw new SetupError("jf_api_key_failed");
}

/** La clé enregistrée sert-elle encore ? (une reprise ne recrée pas de clé pour rien) */
export async function apiKeyWorks(url: string, key: string): Promise<boolean> {
  try {
    await verifyApiKey(url, key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Révoque la clé « Tentacle » d'un Jellyfin abandonné en cours d'installation
 * (un autre a été choisi). Jamais bloquant : un Jellyfin éteint garde une clé
 * que plus personne n'utilise, visible dans son tableau de bord.
 */
export async function revokeApiKey(url: string, key: string): Promise<boolean> {
  const reply = await jellyfinRequest(url, `/Auth/Keys/${encodeURIComponent(key)}`, { method: "DELETE", authorization: jellyfinTokenAuth(key) }).catch(() => null);
  return !!reply && reply.status >= 200 && reply.status < 300;
}
