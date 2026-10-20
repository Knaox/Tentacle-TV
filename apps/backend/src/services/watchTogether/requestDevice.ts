import type { FastifyRequest } from "fastify";
import { getTokenFromRequest } from "../../middleware/auth";
import { hashToken } from "../jwt";

/**
 * L'appareil d'un appel REST de Watch Together : le hash du jeton qui
 * l'authentifie — le même que celui de ses sockets (`routes/ws.ts`), le cookie
 * du web comme l'`Authorization` du bureau et du mobile. C'est lui qui est lié
 * à la salle (1.32.0, adhésion par appareil).
 */
export function deviceKeyOf(request: FastifyRequest): string | undefined {
  const token = getTokenFromRequest(request);
  return token ? hashToken(token) : undefined;
}
