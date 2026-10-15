/**
 * Les plages horaires d'un compte aux portes du cœur : hors plage, le compte
 * ne regarde rien par Tentacle (docs/DROITS-UTILISATEURS.md § 5).
 *
 * Jellyfin ne les vérifie qu'à l'authentification d'un jeton de COMPTE : tout
 * ce que Tentacle sert avec la clé d'administration (TV jumelée, profils,
 * recherche, recommandations) les ignorait. La RÈGLE est celle du socle
 * (`scheduleAllows`, sémantique de Jellyfin) ; ce module n'en fait qu'une porte.
 */

import { getContentPolicy } from "../contentPolicy";
import { scheduleAllows } from "../contentPolicy/externalTitleRule";

/** Ce compte est-il HORS de ses plages horaires, maintenant ? Politique illisible : non (rien à juger). */
export async function outsideAccessSchedule(userId: string, now = new Date()): Promise<boolean> {
  const policy = await getContentPolicy(userId);
  return policy.readable && !scheduleAllows(policy, now);
}

/** La réponse d'une porte hors plage : 403, jamais 401 (le client ne se déconnecte pas). */
export const OUTSIDE_SCHEDULE_REPLY = { error: "outside_access_schedule" } as const;
