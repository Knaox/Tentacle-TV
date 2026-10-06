import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { SetupErrorCode } from "./setupWizardContract";

/**
 * Un refus de l'assistant : un CODE, que le client traduit (espace i18n
 * `setupWizard`). Jamais un message brut, une trace, une réponse de Jellyfin
 * ni un corps de requête renvoyés — ni journalisés : le corps peut porter un
 * mot de passe ou une clé.
 */
export class SetupError extends Error {
  constructor(
    readonly code: SetupErrorCode,
    readonly status = statusOf(code),
  ) {
    super(code);
    this.name = "SetupError";
  }
}

const STATUS: Partial<Record<SetupErrorCode, number>> = {
  setup_closed: 404,
  session_required: 401,
  invalid_token: 401,
  code_required: 403,
  setup_in_progress: 409,
  rate_limited: 429,
  db_managed_by_stack: 409,
  jf_not_configured: 409,
  jf_claim_pending: 409,
  // Un geste hors du parcours en cours : l'état de l'installation l'interdit.
  step_refused: 409,
  internal: 500,
};

export function statusOf(code: SetupErrorCode): number {
  return STATUS[code] ?? 400;
}

export function sendSetupError(reply: FastifyReply, code: SetupErrorCode): FastifyReply {
  return reply.status(statusOf(code)).send({ error: code });
}

/** Le gestionnaire d'erreurs des routes de l'assistant (portée de leur plugin seulement). */
export function setupErrorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (error instanceof SetupError) return sendSetupError(reply, error.code);
  if (error instanceof ZodError) return sendSetupError(reply, "invalid_input");
  const status = (error as FastifyError).statusCode;
  if (status === 429) return sendSetupError(reply, "rate_limited");
  // Corps illisible, trop gros, mauvais type de contenu : la faute du client.
  if (status && status >= 400 && status < 500) return sendSetupError(reply, "invalid_input");
  // Le nom et le message seuls — jamais l'objet requête ni son corps.
  request.log.error({ err: { name: error.name, message: error.message } }, "setup: unexpected error");
  return sendSetupError(reply, "internal");
}
