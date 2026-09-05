import type { FastifyRequest } from "fastify";
import { getTokenFromRequest } from "../middleware/auth";
import { hashToken } from "../services/jwt";
import { sendToUser } from "../services/wsManager";

export type PreferencesScope = "home-layout" | "reco-settings";

/**
 * Après l'enregistrement d'un bloc de préférences : prévenir les AUTRES
 * appareils du compte (`preferences:update`), jamais celui qui vient d'écrire
 * — le jeton de la requête HTTP est celui de son socket (même chaîne sur les
 * quatre clients), son hash désigne ses sockets à sauter.
 */
export function notifyPreferencesUpdate(request: FastifyRequest, userId: string, scope: PreferencesScope): void {
  const token = getTokenFromRequest(request);
  sendToUser(userId, { type: "preferences:update", scope }, token ? { exceptTokenHash: hashToken(token) } : undefined);
}
