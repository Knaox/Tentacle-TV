import type { FastifyReply } from "fastify";
import { FAMILY_ERROR_STATUS, type FamilyErrorBody, type FamilyErrorCode } from "../../family/familyProtocol";

/**
 * Un refus de la Famille : un CODE du contrat (`familyProtocol.ts`), un
 * message français pour les journaux, et les détails que le client affiche
 * (essais restants, fin de blocage, nouvel essai). Les services lèvent, les
 * routes répondent — le statut HTTP vient de la table du contrat, jamais
 * d'ailleurs.
 */
export class FamilyFailure extends Error {
  readonly code: FamilyErrorCode;
  readonly details: Omit<FamilyErrorBody, "code" | "message">;

  constructor(code: FamilyErrorCode, message: string, details: Omit<FamilyErrorBody, "code" | "message"> = {}) {
    super(message);
    this.name = "FamilyFailure";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return FAMILY_ERROR_STATUS[this.code];
  }

  toBody(): FamilyErrorBody {
    return { code: this.code, message: this.message, ...this.details };
  }
}

export function sendFamilyFailure(reply: FastifyReply, failure: FamilyFailure): FastifyReply {
  return reply.status(failure.status).send(failure.toBody());
}

/** Un instant en ISO, pour les détails d'un refus. */
export function iso(ms: number): string {
  return new Date(ms).toISOString();
}
