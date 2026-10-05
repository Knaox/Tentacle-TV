import { randomBytes } from "crypto";

/**
 * Les sessions de l'assistant : un identifiant aléatoire rendu à l'échange du
 * code d'installation, que chaque appel porte dans l'en-tête
 * `X-Tentacle-Setup`. Jamais un cookie : rien ne part tout seul depuis un
 * autre site (aucune requête forgée possible), et l'origine `tentacle://app`
 * du bureau ne porte pas les cookies `SameSite=Strict`.
 *
 * En mémoire seulement : un redémarrage les oublie, et donne un code neuf.
 * Une heure glissante ; trois sessions au plus (un onglet rouvert, un second
 * appareil) — la plus ancienne cède sa place.
 */
const TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 3;
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

/** id → expiration (ms). L'ordre d'insertion de la Map donne la plus ancienne. */
const sessions = new Map<string, number>();

export function openSetupSession(now = Date.now()): string {
  const id = randomBytes(32).toString("base64url");
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }
  sessions.set(id, now + TTL_MS);
  return id;
}

/** La session est valide : son heure repart. */
export function touchSetupSession(id: unknown, now = Date.now()): boolean {
  if (typeof id !== "string" || !SESSION_ID.test(id)) return false;
  const expires = sessions.get(id);
  if (expires === undefined) return false;
  if (expires <= now) {
    sessions.delete(id);
    return false;
  }
  sessions.delete(id);
  sessions.set(id, now + TTL_MS);
  return true;
}

/** Installation finie (ou code changé) : plus aucune session ne vaut. */
export function closeAllSetupSessions(): void {
  sessions.clear();
}
