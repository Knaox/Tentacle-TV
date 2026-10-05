import type { FastifyReply, FastifyRequest } from "fastify";
import { SETUP_HEADER } from "./setupWizardContract";
import { isSetupClosed } from "./setupLock";
import { touchSetupSession } from "./setupSession";
import { sendSetupError } from "./setupErrors";

/**
 * La garde des routes d'action de l'assistant, dans cet ordre :
 *
 *  1. installation finie → 404, pour toujours (rien à découvrir, rien à
 *     rouvrir par HTTP) ;
 *  2. pas de session valide dans l'en-tête `X-Tentacle-Setup` → 401.
 *
 * L'en-tête maison force en plus le préambule CORS de tout appel venu d'un
 * autre site : un formulaire piégé ne peut ni le poser, ni connaître la session.
 */
// Une garde asynchrone qui répond elle-même RENVOIE la réponse : c'est ce qui
// arrête Fastify avant la route.
export async function requireOpenSetup(_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> {
  if (isSetupClosed()) return sendSetupError(reply, "setup_closed");
}

export async function requireSetupSession(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> {
  if (isSetupClosed()) return sendSetupError(reply, "setup_closed");
  if (!touchSetupSession(request.headers[SETUP_HEADER])) return sendSetupError(reply, "session_required");
}
