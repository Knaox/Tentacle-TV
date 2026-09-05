import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getLibraryIndexMemo } from "../services/reco/candidates/libraryMemo";
import { spreadByGenre } from "../services/reco/globalRows";
import { pokePage } from "../services/reco/pageJobs";
import { servePage } from "../services/reco/pageService";

const feedbackSchema = z.object({
  itemKey: z.string().regex(/^(movie|tv):\d+$/),
  action: z.enum(["dismissed", "not_interested", "already_seen"]),
});

/**
 * Rangées de recommandation (COMPAT), feedback, démarrage à froid.
 *
 * `/rows` et `/rows/:rowKey` sont les ADAPTATEURS des anciens clients (un
 * bureau d'avant la page en une requête) : ils lisent le snapshot « all »
 * servi par pageService — plus aucun calcul, plus de relecture du pool par
 * rangée. Les clients à jour passent par GET /page.
 */
export const recoRowRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET /rows — l'état du moteur et la liste ordonnée des rangées ──
  app.get("/rows", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const page = await servePage(user.userId, null);
    return {
      state: page.state,
      signalCount: page.signalCount,
      generating: page.generating,
      refining: page.refining,
      exploring: page.exploring,
      generatedAt: page.generatedAt,
      tmdbConfigured: page.tmdbConfigured,
      personalized: page.personalized,
      rows: page.rows.map(({ key, seedTitle }) => (seedTitle ? { key, seedTitle } : { key })),
    };
  });

  // ── GET /rows/:rowKey — UNE rangée, depuis le snapshot ──
  app.get("/rows/:rowKey", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const { rowKey } = request.params as { rowKey: string };
    const page = await servePage(user.userId, null);
    const row = page.rows.find((r) => r.key === rowKey);
    // Les drapeaux voyagent avec la rangée : le vieux client re-sonde tant
    // qu'ils sont vrais. Une rangée absente du snapshot est vide (il la masque).
    return {
      key: rowKey,
      items: row?.items ?? [],
      seedTitle: row?.seedTitle,
      generatedAt: page.generatedAt ?? undefined,
      generating: page.generating,
      refining: page.refining,
      state: page.state,
    };
  });

  // ── POST /feedback — « ne plus me proposer » : exclusion définitive ──
  app.post("/feedback", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const body = feedbackSchema.parse(request.body);
    const prisma = getPrisma();
    const row = await prisma.recommendationFeedback.upsert({
      where: { jellyfinUserId_itemKey: { jellyfinUserId: user.userId, itemKey: body.itemKey } },
      create: { jellyfinUserId: user.userId, itemKey: body.itemKey, action: body.action },
      update: { action: body.action },
    });
    // L'exclusion est déjà immédiate au service ; la reconstruction en fond
    // recomble la place laissée dans les rangées.
    pokePage(user.userId, "feedback");
    return row;
  });

  // ── DELETE /feedback/:itemKey — annulation (idempotent) ──
  app.delete("/feedback/:itemKey", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const { itemKey } = request.params as { itemKey: string };
    const prisma = getPrisma();
    await prisma.recommendationFeedback.deleteMany({
      where: { jellyfinUserId: user.userId, itemKey },
    });
    pokePage(user.userId, "feedback");
    return { ok: true };
  });

  // ── GET /coldstart — la grille « choisissez cinq titres » : les mieux notés
  //    de la bibliothèque, répartis par genre principal (tour de rôle) pour
  //    représenter TOUTE la collection et pas le seul genre dominant ──
  const COLDSTART_MAX = 60;
  app.get("/coldstart", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const library = await getLibraryIndexMemo(user.userId);
    const sorted = [...library.entries].sort(
      (a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0)
    );
    const pick = spreadByGenre(sorted, COLDSTART_MAX);
    return {
      items: pick.map((e) => ({
        jellyfinItemId: e.itemId,
        name: e.name,
        year: e.ProductionYear ?? null,
        mediaType: e.mediaType,
        tmdbId: e.tmdbId,
      })),
    };
  });
};
