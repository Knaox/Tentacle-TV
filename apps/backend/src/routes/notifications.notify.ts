import type { FastifyRequest } from "fastify";
import { getTokenFromRequest } from "../middleware/auth";
import { hashToken } from "../services/jwt";
import { sendToUser } from "../services/wsManager";

/**
 * Après un geste sur la cloche (lue, tout lu, supprimée) : les AUTRES
 * appareils du compte relisent tout de suite (`notifications:update`) — leur
 * cloche, la pastille de leur icône, et le centre de notifications de leur
 * système, d'où le mobile retire ce qui est lu. Jamais l'appareil qui vient
 * d'écrire : il a déjà son état (optimiste), une relecture l'écraserait.
 * Sans débounce (contrairement à `broadcastToUser`) : « lue ici » doit se
 * voir là-bas à l'instant, pas cinq secondes plus tard.
 */
export function notifyNotificationsChanged(request: FastifyRequest, userId: string): void {
  const token = getTokenFromRequest(request);
  sendToUser(userId, { type: "notifications:update", action: "refresh" }, token ? { exceptTokenHash: hashToken(token) } : undefined);
}
