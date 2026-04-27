import type { StorageAdapter } from "@tentacle-tv/api-client";

/**
 * Gestionnaire de credentials TV — version locale du module mobile.
 *
 * Stocke les identifiants utilisateur dans le storage local (AsyncStorage côté
 * Android TV) pour permettre une ré-authentification automatique en cas
 * d'expiration du token ou de redémarrage du backend Jellyfin.
 *
 * Note: AsyncStorage n'est pas chiffré comme un Keychain natif. Sur Android
 * TV, l'isolation par app + l'absence d'accès root utilisateur fournit un
 * niveau de protection suffisant pour ce contexte (appli grand public).
 */

const CREDENTIALS_KEY = "tentacle_credentials";

export function storeCredentials(
  storage: StorageAdapter,
  username: string,
  password: string,
): void {
  storage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }));
}

export function clearCredentials(storage: StorageAdapter): void {
  storage.removeItem(CREDENTIALS_KEY);
}

/** Lit les credentials stockés. Retourne null si absent ou JSON corrompu. */
export function readCredentials(
  storage: StorageAdapter,
): { username: string; password: string } | null {
  const raw = storage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { username?: string; password?: string };
    if (typeof parsed.username !== "string" || typeof parsed.password !== "string") {
      return null;
    }
    return { username: parsed.username, password: parsed.password };
  } catch {
    clearCredentials(storage);
    return null;
  }
}
