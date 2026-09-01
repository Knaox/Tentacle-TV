import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { ensureFreshPool } from "../services/reco/generationJob";
import { availableRows, buildRow } from "../services/reco/rowBuilder";
import { getLibraryIndexMemo } from "../services/reco/candidates/libraryMemo";
import { getSeerrConfig } from "../services/seerConfig";
import { buildCommunityRow } from "../services/reco/communityRow";
import { serveContext } from "../services/reco/serveContext";

const feedbackSchema = z.object({
  itemKey: z.string().regex(/^(movie|tv):\d+$/),
  action: z.enum(["dismissed", "not_interested", "already_seen"]),
});

/** Rangées de recommandation, feedback, démarrage à froid. */
export const recoRowRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET /rows — l'état du moteur et la liste ordonnée des rangées ──
  app.get("/rows", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const ctx = await serveContext(user.userId);
    if (ctx.state === "disabled" || ctx.state === "cold") {
      return { state: ctx.state, signalCount: ctx.signalCount, generating: false, rows: [] };
    }
    // Profil en construction : générer un pool MAINTENANT le figerait sur un
    // profil vide pour six heures. Le client poll déjà quand `generating`.
    if (ctx.bootstrapping) {
      return {
        state: ctx.state,
        signalCount: ctx.signalCount,
        generating: true,
        refining: true,
        rows: [],
      };
    }
    const { status, pool } = await ensureFreshPool(user.userId);
    const vigieAvailable = ctx.includeVigie && getSeerrConfig() !== null;
    const inLibraryOnly = !ctx.includeVigie;
    let rows = pool ? availableRows(pool, { vigieAvailable, inLibraryOnly }) : [];
    if (!ctx.community) rows = rows.filter((r) => r.key !== "community");
    return {
      state: ctx.state,
      signalCount: ctx.signalCount,
      generating: status === "generating",
      // « refining » : quelque chose de mieux arrive — le client affiche son
      // bandeau « vos recommandations s'affinent » sans vider l'écran.
      refining: status === "generating",
      generatedAt: pool?.generatedAt ?? null,
      rows,
    };
  });

  // ── GET /rows/:rowKey — UNE rangée, dérivée du pool à chaque service ──
  app.get("/rows/:rowKey", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const { rowKey } = request.params as { rowKey: string };
    const ctx = await serveContext(user.userId);
    if (ctx.state === "disabled" || ctx.state === "cold") {
      return { key: rowKey, items: [], state: ctx.state };
    }
    if (ctx.bootstrapping) {
      return { key: rowKey, items: [], generating: true, refining: true };
    }
    // La rangée communautaire vit sur la table de cooccurrences, pas sur le
    // pool ; le réglage « recommandations communautaires » la coupe net.
    if (rowKey === "community") {
      if (!ctx.community) return { key: rowKey, items: [] };
      const library = await getLibraryIndexMemo(user.userId);
      return buildCommunityRow(user.userId, library, ctx.exclude, !ctx.includeVigie);
    }
    const { status, pool } = await ensureFreshPool(user.userId);
    if (!pool) {
      return { key: rowKey, items: [], generating: status === "generating" };
    }
    const vigieAvailable = ctx.includeVigie && getSeerrConfig() !== null;
    const row = buildRow(pool, rowKey, {
      exclude: ctx.exclude,
      vigieAvailable,
      inLibraryOnly: !ctx.includeVigie,
      lambda: ctx.lambda,
      profile: ctx.profile,
    });
    return row ?? { key: rowKey, items: [] };
  });

  // ── POST /feedback — « ne plus me proposer » : exclusion définitive ──
  app.post("/feedback", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const body = feedbackSchema.parse(request.body);
    const prisma = getPrisma();
    return prisma.recommendationFeedback.upsert({
      where: { jellyfinUserId_itemKey: { jellyfinUserId: user.userId, itemKey: body.itemKey } },
      create: { jellyfinUserId: user.userId, itemKey: body.itemKey, action: body.action },
      update: { action: body.action },
    });
  });

  // ── DELETE /feedback/:itemKey — annulation (idempotent) ──
  app.delete("/feedback/:itemKey", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const { itemKey } = request.params as { itemKey: string };
    const prisma = getPrisma();
    await prisma.recommendationFeedback.deleteMany({
      where: { jellyfinUserId: user.userId, itemKey },
    });
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
    const byGenre = new Map<string, typeof sorted>();
    for (const e of sorted) {
      const genre = e.Genres?.[0] ?? "";
      const bucket = byGenre.get(genre);
      if (bucket) bucket.push(e);
      else byGenre.set(genre, [e]);
    }
    const buckets = [...byGenre.values()];
    const pick: typeof sorted = [];
    for (let rank = 0; pick.length < COLDSTART_MAX; rank++) {
      let added = false;
      for (const bucket of buckets) {
        if (rank < bucket.length && pick.length < COLDSTART_MAX) {
          pick.push(bucket[rank]);
          added = true;
        }
      }
      if (!added) break;
    }
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
