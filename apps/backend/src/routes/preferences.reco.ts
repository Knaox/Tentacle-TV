import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import { bootstrapPool } from "../services/reco/generationJob";
import { invalidatePool } from "../services/reco/poolStore";
import { pokePage } from "../services/reco/pageJobs";
import { PROVIDER_FILTER_MAX, providerFilterFromQuery } from "../services/reco/providerFilter";

const settingsSchema = z.object({
  personalized: z.boolean(),
  includeVigie: z.boolean(),
  community: z.boolean(),
  /** false = désinscription : l'historique n'alimente plus la cooccurrence. */
  shareHistory: z.boolean(),
  /** Curseur « Sûr ↔ Aventureux » : λ du MMR × 100. */
  explorationBalance: z.number().int().min(0).max(100),
  /** Filtre de plateformes de la page Recommandations (ids TMDB principaux).
   *  Absent chez un vieux client : le bloc entier est remplacé, sans filtre. */
  providerFilter: z.array(z.number().int().positive()).max(PROVIDER_FILTER_MAX).default([]),
});

export type RecoSettingsPayload = z.infer<typeof settingsSchema>;

export const DEFAULT_RECO_SETTINGS: RecoSettingsPayload = {
  personalized: true,
  includeVigie: true,
  community: true,
  shareHistory: true,
  explorationBalance: 70,
  providerFilter: [],
};

/** La colonne JSON → ids canoniques ; illisible = aucun filtre. */
export function parseProviderFilter(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    return providerFilterFromQuery(JSON.parse(raw)) ?? [];
  } catch {
    return [];
  }
}

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
        providerFilter: parseProviderFilter(row.providerFilter),
      },
    };
  });

  app.put("/reco", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const settings = settingsSchema.parse(request.body);
    const prisma = getPrisma();
    const before = await prisma.recoSettings.findUnique({
      where: { jellyfinUserId: user.userId },
      select: { includeVigie: true },
    });
    // Ids canonisés (l'id principal de chaque famille) : la clé de snapshot
    // du filtre sauvegardé est la même que celle de la requête de page.
    const providerFilter = providerFilterFromQuery(settings.providerFilter) ?? [];
    const data = { ...settings, providerFilter: JSON.stringify(providerFilter) };
    await prisma.recoSettings.upsert({
      where: { jellyfinUserId: user.userId },
      create: { jellyfinUserId: user.userId, ...data },
      update: data,
    });
    // La page se reconstruit en fond avec les réglages neufs (curseur,
    // interrupteurs, filtre sauvegardé) — la prochaine visite est déjà prête.
    pokePage(user.userId, "settings");
    // includeVigie change la MATIÈRE du pool (sources interrogées), pas
    // seulement son service : attendre l'expiration (6 h) trahirait le
    // réglage. Invalidation APRÈS l'upsert — la régénération relit le neuf.
    // Les quatre autres réglages s'appliquent à la volée au service.
    // Passe rapide d'abord (quelques secondes, zéro réseau) : le trou de
    // service se compte en secondes, plus en dizaines.
    const beforeVigie = before?.includeVigie ?? DEFAULT_RECO_SETTINGS.includeVigie;
    if (beforeVigie !== settings.includeVigie) {
      await invalidatePool(user.userId);
      void bootstrapPool(user.userId).catch(() => undefined);
    }
    return { ok: true };
  });
}
