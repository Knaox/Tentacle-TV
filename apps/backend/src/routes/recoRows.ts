import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { ensureFreshPool } from "../services/reco/generationJob";
import { availableRows, buildRow } from "../services/reco/rowBuilder";
import { canonicalKey } from "../services/reco/candidates/exclusions";
import { buildLibraryIndex } from "../services/reco/candidates/libraryIndex";
import type { LibraryIndex } from "../services/reco/candidates/libraryIndex";
import { getSeerrConfig } from "../services/seerConfig";
import type { TasteVector } from "../services/reco/scoring/strategy";

const feedbackSchema = z.object({
  itemKey: z.string().regex(/^(movie|tv):\d+$/),
  action: z.enum(["dismissed", "not_interested", "already_seen"]),
});

// Démarrage à froid (spec) : < 5 signaux → pas de reco personnalisée du tout ;
// 5..14 → recos servies avec l'indicateur « vos recommandations s'affinent ».
const COLD_MIN_SIGNALS = 5;
const WARMING_MIN_SIGNALS = 15;

type RecoState = "disabled" | "cold" | "warming" | "ready";

interface ServeContext {
  state: RecoState;
  signalCount: number;
  lambda: number;
  includeVigie: boolean;
  community: boolean;
  exclude: Set<string>;
  profile: TasteVector;
}

async function serveContext(userId: string): Promise<ServeContext> {
  const prisma = getPrisma();
  const [profileRow, settings, ratings, feedback] = await Promise.all([
    prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } }),
    prisma.recoSettings.findUnique({ where: { jellyfinUserId: userId } }),
    prisma.userRating.findMany({
      where: { jellyfinUserId: userId, deletedAt: null },
      select: { mediaType: true, tmdbId: true },
    }),
    prisma.recommendationFeedback.findMany({
      where: { jellyfinUserId: userId },
      select: { itemKey: true },
    }),
  ]);

  // Exclusions du MOMENT : une note posée il y a dix secondes ou un « ne plus
  // me proposer » sortent le titre des rangées sans attendre la régénération.
  const exclude = new Set<string>();
  for (const r of ratings) exclude.add(canonicalKey(r.mediaType, r.tmdbId));
  for (const f of feedback) exclude.add(f.itemKey);

  let facets: Record<string, number> = {};
  try {
    facets = profileRow ? (JSON.parse(profileRow.facets) as Record<string, number>) : {};
  } catch {
    // Profil illisible : rangées sur profil vide, le rebuild réécrira.
  }
  const signalCount = profileRow?.signalCount ?? 0;
  const personalized = settings?.personalized ?? true;
  const state: RecoState = !personalized
    ? "disabled"
    : signalCount < COLD_MIN_SIGNALS
      ? "cold"
      : signalCount < WARMING_MIN_SIGNALS
        ? "warming"
        : "ready";

  return {
    state,
    signalCount,
    lambda: (settings?.explorationBalance ?? 70) / 100,
    includeVigie: settings?.includeVigie ?? true,
    community: settings?.community ?? true,
    exclude,
    profile: { facets, signalCount },
  };
}

// L'index de bibliothèque est un balayage complet : mémoïsé dix minutes pour
// la grille de démarrage à froid (seule consommatrice par requête HTTP).
const libraryMemo = new Map<string, { at: number; index: LibraryIndex }>();
const LIBRARY_MEMO_MS = 10 * 60_000;

async function memoizedLibrary(userId: string): Promise<LibraryIndex> {
  const hit = libraryMemo.get(userId);
  if (hit && Date.now() - hit.at < LIBRARY_MEMO_MS) return hit.index;
  const index = await buildLibraryIndex(userId);
  libraryMemo.set(userId, { at: Date.now(), index });
  return index;
}

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
    const { status, pool } = await ensureFreshPool(user.userId);
    const vigieAvailable = ctx.includeVigie && getSeerrConfig() !== null;
    let rows = pool ? availableRows(pool, { vigieAvailable }) : [];
    if (!ctx.community) rows = rows.filter((r) => r.key !== "community");
    return {
      state: ctx.state,
      signalCount: ctx.signalCount,
      generating: status === "generating",
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
    // La rangée communautaire vit sur la table de cooccurrences (Phase 6).
    if (rowKey === "community") {
      return { key: rowKey, items: [], pending: true };
    }
    const { status, pool } = await ensureFreshPool(user.userId);
    if (!pool) {
      return { key: rowKey, items: [], generating: status === "generating" };
    }
    const vigieAvailable = ctx.includeVigie && getSeerrConfig() !== null;
    const row = buildRow(pool, rowKey, {
      exclude: ctx.exclude,
      vigieAvailable,
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

  // ── GET /coldstart — la grille « notez cinq titres » : populaires de la
  //    bibliothèque, non vus d'abord, notables (tmdbId présent par index) ──
  app.get("/coldstart", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const library = await memoizedLibrary(user.userId);
    const sorted = [...library.entries].sort(
      (a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0)
    );
    const pick = [...sorted.filter((e) => !e.played), ...sorted.filter((e) => e.played)].slice(0, 30);
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
