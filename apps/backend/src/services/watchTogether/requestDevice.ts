import type { FastifyReply, FastifyRequest } from "fastify";
import { getTokenFromRequest } from "../../middleware/auth";
import { hashToken } from "../jwt";
import { getRoomOf } from "./roomRegistry";
import { isDeviceBound } from "./memberDevices";

/**
 * L'appareil d'un appel REST de Watch Together : le hash du jeton qui
 * l'authentifie — le même que celui de ses sockets (`routes/ws.ts`), le cookie
 * du web comme l'`Authorization` du bureau et du mobile. C'est lui qui est lié
 * à la salle (1.31.1, adhésion par appareil).
 */
export function deviceKeyOf(request: FastifyRequest): string | undefined {
  const token = getTokenFromRequest(request);
  return token ? hashToken(token) : undefined;
}

/**
 * Garde des routes de la SÉANCE (affinité…) : un appareil du compte qui n'est
 * pas lié à sa salle n'y a pas accès — pour lui, il n'y a pas de groupe
 * (404 `not_in_group`, la réponse d'un compte hors salle). Un compte hors
 * salle passe : la route répond d'elle-même.
 */
export async function refuseUnboundDevice(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = (request as { user?: { userId: string } }).user?.userId;
  const member = userId ? getRoomOf(userId)?.members.get(userId) : undefined;
  if (member && !isDeviceBound(member, deviceKeyOf(request))) {
    await reply.status(404).send({ code: "not_in_group" });
  }
}
