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
 * schéma à migrer. Rien de masqué = aucune ligne. Un masquage peut retenir
 * une MARQUE (`serverUpdate` : l'exigence de version en vigueur) : l'entrée
 * devient `{ hint, mark }`, qu'un serveur d'avant ignore sans erreur. Chaque
 * réponse annonce aussi la liste fermée du serveur (`known`) : un client
 * n'offre « Ne plus afficher » que pour ce que SON serveur sait retenir.
 * Contrat : `help/dismissibleHints.ts` (miroir de shared).
 *
 * Enregistré depuis `preferences.ts` : le hook `requireAuth` du plugin s'applique.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import {
  DISMISSIBLE_HINTS,
  HINT_MARK_MAX_LENGTH,
  normalizeDismissedHints,
  normalizeHintMarks,
  storedHintEntries,
  type DismissedHintMarks,
  type DismissedHintsResponse,
  type DismissibleHint,
} from "../help/dismissibleHints";
import { notifyPreferencesUpdate } from "./preferences.notify";

const paramsSchema = z.object({ hint: z.enum(DISMISSIBLE_HINTS) });
const bodySchema = z.object({
  dismissed: z.boolean(),
  mark: z.string().min(1).max(HINT_MARK_MAX_LENGTH).regex(/^[\w.+-]+$/).optional(),
});

interface HintsState {
  dismissed: DismissibleHint[];
  marks: DismissedHintMarks;
}

export function hintsConfigKey(userId: string): string {
  return `user_hints_${userId}`;
}

/** Une ligne illisible vaut « rien de masqué » : au pire le rappel revient, jamais d'erreur. */
async function readState(userId: string): Promise<HintsState> {
  const row = await getPrisma().serverConfig.findUnique({ where: { key: hintsConfigKey(userId) } });
  if (!row) return { dismissed: [], marks: {} };
  try {
    const raw: unknown = JSON.parse(row.value);
    return { dismissed: normalizeDismissedHints(raw), marks: normalizeHintMarks(raw) };
  } catch {
    return { dismissed: [], marks: {} };
  }
}

/** La réponse : les rappels masqués, leurs marques, et la liste fermée de ce serveur. */
function responseOf(state: HintsState): DismissedHintsResponse {
  const marks: DismissedHintMarks = {};
  for (const hint of state.dismissed) {
    const mark = state.marks[hint];
    if (mark) marks[hint] = mark;
  }
  return { dismissed: state.dismissed, marks, known: [...DISMISSIBLE_HINTS] };
}

export function registerHintsRoutes(app: FastifyInstance): void {
  app.get("/hints", async (request): Promise<DismissedHintsResponse> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    return responseOf(await readState(user.userId));
  });

  // Masquer ou réafficher UN rappel : la réponse est la liste complète, que
  // le client pose telle quelle dans son cache. Masquer de nouveau remplace
  // la marque ; masquer sans marque l'efface ; réafficher l'oublie.
  app.put("/hints/:hint", async (request): Promise<DismissedHintsResponse> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    const { hint } = paramsSchema.parse(request.params);
    const { dismissed, mark } = bodySchema.parse(request.body);
    const current = await readState(user.userId);
    const marks: DismissedHintMarks = { ...current.marks };
    delete marks[hint];
    if (dismissed && mark) marks[hint] = mark;
    const next: HintsState = {
      dismissed: normalizeDismissedHints(dismissed ? [...current.dismissed, hint] : current.dismissed.filter((entry) => entry !== hint)),
      marks,
    };

    const prisma = getPrisma();
    const key = hintsConfigKey(user.userId);
    if (next.dismissed.length === 0) {
      await prisma.serverConfig.deleteMany({ where: { key } });
    } else {
      const value = JSON.stringify(storedHintEntries(next.dismissed, next.marks));
      await prisma.serverConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
    notifyPreferencesUpdate(request, user.userId, "hints");
    return responseOf(next);
  });
}
