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
 *
 * Chaque session est LIÉE à l'adresse qui l'a ouverte : volée (journal,
 * capture d'écran), elle ne sert à rien d'ailleurs. Une autre adresse passe
 * par le code.
 */
const TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 3;
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

interface SetupSession {
  expires: number;
  address: string;
}

/** id → session. L'ordre d'insertion de la Map donne la plus ancienne. */
const sessions = new Map<string, SetupSession>();

export function openSetupSession(address: string, now = Date.now()): string {
  const id = randomBytes(32).toString("base64url");
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }
  sessions.set(id, { expires: now + TTL_MS, address });
  return id;
}

/** La session est valide, et utilisée depuis l'adresse qui l'a ouverte : son heure repart. */
export function touchSetupSession(id: unknown, address: string, now = Date.now()): boolean {
  if (typeof id !== "string" || !SESSION_ID.test(id)) return false;
  const session = sessions.get(id);
  if (session === undefined) return false;
  if (session.expires <= now) {
    sessions.delete(id);
    return false;
  }
  if (session.address !== address) return false;
  sessions.delete(id);
  sessions.set(id, { expires: now + TTL_MS, address });
  return true;
}

/** Une installation est en cours depuis une AUTRE adresse (session encore valide). */
export function sessionHeldElsewhere(address: string, now = Date.now()): boolean {
  for (const session of sessions.values()) if (session.expires > now && session.address !== address) return true;
  return false;
}

/** Installation finie (ou code changé) : plus aucune session ne vaut. */
export function closeAllSetupSessions(): void {
  sessions.clear();
}
