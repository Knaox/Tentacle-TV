import type { FastifyRequest } from "fastify";
import { getRealClientIp } from "../../services/networkUtils";
import { readDefaultGateway } from "../discovery/candidates";
import { hostInfo } from "../hostInfo";
import type { SetupErrorCode } from "../setupWizardContract";
import { sessionHeldElsewhere } from "../setupSession";
import { claimantAddress } from "./claimant";
import { judgeClient, type ClientVerdict } from "./directClient";
import { bareIp } from "./privateAddress";

/**
 * Ce qu'un navigateur peut faire de l'assistant, sans code : l'ouvrir s'il
 * arrive directement du réseau local et que personne d'autre ne l'a réclamé
 * (cf. `directClient.ts`, `claimant.ts`, `docs/server/setup-security.md`).
 */
export interface SetupAccess {
  /** L'adresse réelle du navigateur, celle à laquelle sa session sera liée. */
  address: string;
  verdict: ClientVerdict;
  /** Le refus d'une ouverture sans code ; `null` : elle est permise. */
  refusal: Extract<SetupErrorCode, "code_required" | "setup_in_progress"> | null;
}

/** L'adresse à laquelle une session de l'assistant est liée. */
export function clientAddress(request: FastifyRequest): string {
  return bareIp(getRealClientIp(request));
}

export function setupAccessFor(request: FastifyRequest): SetupAccess {
  const address = clientAddress(request);
  const verdict = judgeClient({
    peer: request.socket?.remoteAddress,
    realIp: address,
    headers: request.headers,
    browserHost: request.hostname,
    gateway: hostInfo().containerized ? readDefaultGateway() : null,
  });
  if (verdict !== "local") return { address, verdict, refusal: "code_required" };
  const claimant = claimantAddress();
  // Le voisin verrouillé : une installation commencée ailleurs ne se reprend qu'avec le code.
  // Celui qui l'a réclamée la retrouve (onglet fermé, session expirée).
  const heldElsewhere = claimant ? claimant !== address : sessionHeldElsewhere(address);
  if (heldElsewhere) return { address, verdict, refusal: "setup_in_progress" };
  return { address, verdict, refusal: null };
}
