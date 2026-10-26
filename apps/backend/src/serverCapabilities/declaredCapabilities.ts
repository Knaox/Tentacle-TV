import type { FastifyReply, FastifyRequest } from "fastify";
import { BACKEND_VERSION } from "../services/version";
import { serverCapabilitiesAt, type ServerCapability } from "./serverCapabilities";

/**
 * `GET /api/config` → `capabilities` : ce que CE serveur sait faire ET a le
 * droit de montrer.
 *
 * Le miroir est celui du code : chaque clé qu'il porte, son code la sert. Mais
 * une clé ne se DÉCLARE que si la version du serveur atteint son `since`
 * (`serverCapabilitiesAt`) : du code livré en avance (Octave, Sillon : 1.40.0)
 * reste invisible sur un serveur plus ancien, et ses routes refusent
 * (`capabilityGate`). La version est celle du serveur, fixée au build par
 * `TENTACLE_SERVER_VERSION` le cas échéant (`services/version.ts`).
 *
 * Une fonction que l'administration peut COUPER n'est pas une capacité mais un
 * réglage : elle va dans `features` (cf. `features.family`), qui dit ce qui est
 * permis.
 */
export function declaredServerCapabilities(version: string = BACKEND_VERSION): ServerCapability[] {
  return serverCapabilitiesAt(version);
}

let declared: ReadonlySet<ServerCapability> | null = null;

/** La clé est-elle déclarée par ce serveur ? (Sa version ne change pas en cours de route.) */
export function isCapabilityDeclared(key: ServerCapability): boolean {
  declared ??= new Set(declaredServerCapabilities());
  return declared.has(key);
}

/** Le refus d'une route dont la capacité n'est pas déclarée : rien à voir ici, sans détail. */
export const CAPABILITY_NOT_AVAILABLE = { error: "not_available" } as const;

/**
 * Crochet Fastify (`onRequest`) : une route dont la capacité n'est pas déclarée
 * répond 404 `not_available`, avant toute garde — elle n'existe pas sur ce serveur.
 */
export function capabilityGate(key: ServerCapability) {
  return async (_request: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
    if (!isCapabilityDeclared(key)) return reply.status(404).send(CAPABILITY_NOT_AVAILABLE);
  };
}

export function resetDeclaredCapabilitiesForTests(): void {
  declared = null;
}
