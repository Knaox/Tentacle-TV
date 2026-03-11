import type { StorageAdapter } from "@tentacle-tv/api-client";

const CREDENTIALS_KEY = "tentacle_credentials";

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
 * - Succès : retourne { AccessToken, User }
 * - Échec auth (401/400) : efface les credentials, retourne null
 * - Erreur réseau : retourne null SANS effacer (réessai possible)
 */
export async function attemptReAuth(
  storage: StorageAdapter,
  serverUrl: string,
): Promise<{ AccessToken: string; User: Record<string, unknown> } | null> {
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
      body: JSON.stringify(credentials),
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
