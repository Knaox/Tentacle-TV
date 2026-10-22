import crypto from "crypto";
import { z } from "zod";
import { getPrisma } from "../../services/db";

/** Ce que partagent les deux flux de jumelage par code (`pair.ts`,
 *  `pairing/deviceFlow.ts`) : l'alphabet, la durée de vie, les corps. */

const PAIR_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
export const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateCode(): string {
  // randomInt : tirage uniforme sur l'alphabet (le modulo d'un octet favorisait
  // les premières lettres, 256 n'étant pas un multiple de 31).
  return Array.from({ length: CODE_LENGTH }, () => PAIR_CHARS[crypto.randomInt(PAIR_CHARS.length)]).join("");
}

export const generateSchema = z.object({
  deviceName: z.string().max(100).optional(),
});

export const claimSchema = z.object({
  code: z
    .string()
    .length(4)
    .transform((s) => s.toUpperCase()),
  deviceName: z.string().max(100).optional(),
});

/** Purge les codes expirés puis tire un code libre ; `null` après dix collisions. */
export async function freshPairingCode(): Promise<string | null> {
  const prisma = getPrisma();
  await prisma.pairingCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  for (let i = 0; i < 10; i++) {
    const candidate = generateCode();
    const existing = await prisma.pairingCode.findUnique({
      where: { code: candidate },
    });
    if (!existing) return candidate;
  }
  return null;
}
