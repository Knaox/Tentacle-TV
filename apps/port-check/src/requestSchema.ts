import { isIP } from "net";
import { z } from "zod";
import { CHALLENGE_PATTERN, CHECK_MAX_TARGETS, isCheckablePort } from "./checkProtocol";

/**
 * La demande, stricte : un champ inconnu est un refus. Pas d'adresse cible —
 * le service teste l'adresse du demandeur ; un nom de domaine seulement, qui
 * n'est suivi que s'il désigne cette adresse.
 */
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function isHostname(value: string): boolean {
  if (value.length > 253 || isIP(value)) return false;
  const labels = value.split(".");
  return labels.length >= 2 && labels.every((l) => LABEL.test(l)) && !/^\d+$/.test(labels[labels.length - 1]);
}

const target = z
  .object({
    service: z.enum(["tentacle", "jellyfin"]),
    scheme: z.enum(["http", "https"]),
    port: z.number().int().refine(isCheckablePort),
    host: z.string().toLowerCase().refine(isHostname).optional(),
  })
  .strict();

export const checkRequestSchema = z
  .object({
    challenge: z.object({ id: z.string().regex(CHALLENGE_PATTERN), token: z.string().regex(CHALLENGE_PATTERN) }).strict(),
    jellyfinId: z.string().regex(CHALLENGE_PATTERN).optional(),
    targets: z.array(target).min(1).max(CHECK_MAX_TARGETS),
  })
  .strict();

export type ParsedCheckRequest = z.infer<typeof checkRequestSchema>;
