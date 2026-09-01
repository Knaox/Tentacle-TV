import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";

const settingsSchema = z.object({
  personalized: z.boolean(),
  includeVigie: z.boolean(),
  community: z.boolean(),
  /** false = désinscription : l'historique n'alimente plus la cooccurrence. */
  shareHistory: z.boolean(),
  /** Curseur « Sûr ↔ Aventureux » : λ du MMR × 100. */
  explorationBalance: z.number().int().min(0).max(100),
});

export type RecoSettingsPayload = z.infer<typeof settingsSchema>;

export const DEFAULT_RECO_SETTINGS: RecoSettingsPayload = {
  personalized: true,
  includeVigie: true,
  community: true,
  shareHistory: true,
  explorationBalance: 70,
};

/** GET /reco — défauts servis (`stored: false`), jamais 404.
 *  PUT /reco — remplace le bloc entier (cinq réglages, une donnée). */
export function registerRecoSettingsRoutes(app: FastifyInstance): void {
  app.get("/reco", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const row = await prisma.recoSettings.findUnique({ where: { jellyfinUserId: user.userId } });
    if (!row) return { stored: false, settings: DEFAULT_RECO_SETTINGS };
    return {
      stored: true,
      settings: {
        personalized: row.personalized,
        includeVigie: row.includeVigie,
        community: row.community,
        shareHistory: row.shareHistory,
        explorationBalance: row.explorationBalance,
      },
    };
  });

  app.put("/reco", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const settings = settingsSchema.parse(request.body);
    const prisma = getPrisma();
    await prisma.recoSettings.upsert({
      where: { jellyfinUserId: user.userId },
      create: { jellyfinUserId: user.userId, ...settings },
      update: settings,
    });
    return { ok: true };
  });
}
