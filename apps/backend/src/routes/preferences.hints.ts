/**
 * GET/PUT /api/preferences/hints — les rappels que le compte a masqués pour
 * de bon (« Vous ne voyez pas les bandes-annonces ? »…). Une préférence du
 * COMPTE, pas de l'appareil : masqué sur le téléphone, un rappel quitte aussi
 * le web, le bureau et les téléviseurs, où la télécommande ne peut pas le
 * masquer. Les autres appareils du compte l'apprennent en direct
 * (`preferences:update`, portée `hints`).
 *
 * Rangé dans `server_config` sous `user_hints_<userId>` — une liste JSON —,
 * comme la langue d'interface (`user_lang_<userId>`) : aucune table, aucun
 * schéma à migrer. Rien de masqué = aucune ligne. Contrat :
 * `help/dismissibleHints.ts` (miroir de shared).
 *
 * Enregistré depuis `preferences.ts` : le hook `requireAuth` du plugin s'applique.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import {
  DISMISSIBLE_HINTS,
  normalizeDismissedHints,
  type DismissedHintsResponse,
  type DismissibleHint,
} from "../help/dismissibleHints";
import { notifyPreferencesUpdate } from "./preferences.notify";

const paramsSchema = z.object({ hint: z.enum(DISMISSIBLE_HINTS) });
const bodySchema = z.object({ dismissed: z.boolean() });

export function hintsConfigKey(userId: string): string {
  return `user_hints_${userId}`;
}

/** Une ligne illisible vaut « rien de masqué » : au pire le rappel revient, jamais d'erreur. */
async function readDismissed(userId: string): Promise<DismissibleHint[]> {
  const row = await getPrisma().serverConfig.findUnique({ where: { key: hintsConfigKey(userId) } });
  if (!row) return [];
  try {
    return normalizeDismissedHints(JSON.parse(row.value));
  } catch {
    return [];
  }
}

export function registerHintsRoutes(app: FastifyInstance): void {
  app.get("/hints", async (request): Promise<DismissedHintsResponse> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    return { dismissed: await readDismissed(user.userId) };
  });

  // Masquer ou réafficher UN rappel : la réponse est la liste complète, que
  // le client pose telle quelle dans son cache.
  app.put("/hints/:hint", async (request): Promise<DismissedHintsResponse> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    const { hint } = paramsSchema.parse(request.params);
    const { dismissed } = bodySchema.parse(request.body);
    const current = await readDismissed(user.userId);
    const next = normalizeDismissedHints(dismissed ? [...current, hint] : current.filter((entry) => entry !== hint));

    const prisma = getPrisma();
    const key = hintsConfigKey(user.userId);
    if (next.length === 0) {
      await prisma.serverConfig.deleteMany({ where: { key } });
    } else {
      const value = JSON.stringify(next);
      await prisma.serverConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
    notifyPreferencesUpdate(request, user.userId, "hints");
    return { dismissed: next };
  });
}
