import type { StorageAdapter } from "@tentacle-tv/api-client";

const CREDENTIALS_KEY = "tentacle_credentials";

/** L'identité d'appareil qui accompagne un login. Le token Jellyfin est frappé
 *  sous ce triplet (DeviceId, Client, Device) — il DOIT être celui que le
 *  client présentera ensuite dans ses en-têtes MediaBrowser, sans quoi
 *  Jellyfin refuse les routes indexées par session (/Sessions/Playing*).
 *  Sans triplet, le backend dérive l'appareil du NOM DE COMPTE : tous les
 *  mobiles du compte partagent alors le même appareil Jellyfin et se
 *  révoquent mutuellement à chaque login (cf. jellyfinIdentity, serveur). */
export interface LoginIdentity {
  deviceId: string;
  client: string;
  device: string;
}

/** Le triplet d'identité d'un client Jellyfin, prêt à joindre au corps d'un
 *  login. La graine (`getLoginDeviceId`) — jamais l'identité adoptée : le
 *  backend la re-hacherait et l'appareil changerait de nom à chaque fois. */
export function loginIdentity(client: {
  getLoginDeviceId(): string;
  getClientName(): string;
  getDeviceName(): string;
}): LoginIdentity {
  return {
    deviceId: client.getLoginDeviceId(),
    client: client.getClientName(),
    device: client.getDeviceName(),
  };
}

/** Sauvegarde les credentials dans le Keychain/Keystore via SecureStore. */
export function storeCredentials(storage: StorageAdapter, username: string, password: string): void {
  storage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }));
}

/** Supprime les credentials stockés (logout). */
export function clearCredentials(storage: StorageAdapter): void {
  storage.removeItem(CREDENTIALS_KEY);
}

/**
 * Tente une ré-authentification automatique via les credentials stockés.
 * - Succès : retourne { AccessToken, User, DeviceId } — l'appelant ADOPTE le
 *   DeviceId (`client.adoptJellyfinDeviceId`) pour aligner ses en-têtes.
 * - Échec auth (401/400) : efface les credentials, retourne null
 * - Erreur réseau : retourne null SANS effacer (réessai possible)
 */
export async function attemptReAuth(
  storage: StorageAdapter,
  serverUrl: string,
  identity: LoginIdentity,
): Promise<{ AccessToken: string; User: Record<string, unknown>; DeviceId?: string } | null> {
  const raw = storage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;

  let credentials: { username: string; password: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    clearCredentials(storage);
    return null;
  }

  try {
    const res = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...credentials, ...identity }),
    });

    if (res.ok) {
      const data = await res.json();
      console.debug("[credentialManager] Re-auth succeeded");
      return data;
    }

    // Auth failure (wrong password, account disabled, etc.) — clear stale credentials
    if (res.status === 401 || res.status === 400) {
      console.debug("[credentialManager] Re-auth failed (credentials invalid) — clearing");
      clearCredentials(storage);
    }

    return null;
  } catch {
    // Network error — keep credentials for retry
    console.debug("[credentialManager] Re-auth failed (network) — keeping credentials");
    return null;
  }
}
