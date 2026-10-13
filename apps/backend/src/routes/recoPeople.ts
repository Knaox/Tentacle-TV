import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { bootstrapPool } from "../services/reco/generationJob";
import { pokePage } from "../services/reco/pageJobs";
import { invalidatePool } from "../services/reco/poolStore";
import { tmdbConfigured, tmdbFetch } from "../services/tmdb/client";
import { getCachedMetaMany } from "../services/tmdb/metaCache";
import { parseAnchors } from "../services/reco/anchorStore";
import { isAdultPerson, popularSuggestions, recurringActors, toSuggestion } from "../services/reco/peopleSuggestions";
import type { RawPerson } from "../services/reco/peopleSuggestions";

const SUGGESTIONS_MAX = 12;

const likeSchema = z.object({
  /** id TMDB — absent quand le like vient du casting Jellyfin (résolu ici). */
  personId: z.number().int().positive().optional(),
  name: z.string().min(1).max(255),
  profilePath: z.string().max(255).nullish(),
});

/**
 * Personnes aimées : recherche TMDB, liste, like/unlike. Un changement
 * invalide le pool et régénère en fond — action explicite et rare, la
 * rangée « Avec {acteur} » doit apparaître sans attendre six heures.
 */
export const recoPeopleRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET /people/search?query= — proxy /search/person, réponse réduite ──
  app.get("/people/search", async (request, reply) => {
    const { query } = request.query as { query?: string };
    if (!query || query.trim().length < 2) {
      return reply.status(400).send({ error: "query-too-short" });
    }
    if (!tmdbConfigured()) return { results: [] };
    try {
      const page = await tmdbFetch<{ results?: RawPerson[] }>("/search/person", {
        query: query.trim(),
        page: "1",
        include_adult: "false",
      });
      return { results: (page.results ?? []).filter((p) => !isAdultPerson(p)).slice(0, 8).map(toSuggestion) };
    } catch {
      return { results: [] };
    }
  });

  // ── GET /people/suggestions — d'abord les acteurs qui reviennent dans ce que
  //    le compte a regardé, puis les personnalités populaires de TMDB ; jamais
  //    une personne ou une filmographie pour adultes, ni une personne déjà aimée ──
  app.get("/people/suggestions", async (request) => {
    const user = (request as any).user as JellyfinUser;
    if (!tmdbConfigured()) return { results: [] };
    const prisma = getPrisma();
    const [liked, profile] = await Promise.all([
      prisma.userLikedPerson.findMany({ where: { jellyfinUserId: user.userId }, select: { personId: true } }),
      prisma.tasteProfile.findUnique({ where: { jellyfinUserId: user.userId }, select: { anchors: true } }),
    ]);
    const likedIds = new Set(liked.map((l) => l.personId));
    const anchors = (parseAnchors(profile?.anchors) ?? []).filter((a) => a.tmdbId > 0);
    const metas = await getCachedMetaMany(anchors.map((a) => ({ mediaType: a.mediaType, tmdbId: a.tmdbId })));
    const own = recurringActors(anchors, (a) => metas.get(a.key), likedIds).slice(0, SUGGESTIONS_MAX);
    if (own.length >= SUGGESTIONS_MAX) return { results: own };
    try {
      const page = await tmdbFetch<{ results?: RawPerson[] }>("/person/popular", { page: "1" });
      const taken = new Set([...likedIds, ...own.map((p) => p.personId)]);
      return { results: [...own, ...popularSuggestions(page.results ?? [], taken)].slice(0, SUGGESTIONS_MAX) };
    } catch {
      return { results: own };
    }
  });

  // ── GET /people — les personnes aimées du compte ──
  app.get("/people", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const prisma = getPrisma();
    const rows = await prisma.userLikedPerson.findMany({
      where: { jellyfinUserId: user.userId },
      orderBy: { createdAt: "desc" },
    });
    return {
      people: rows.map((r) => ({ personId: r.personId, name: r.name, profilePath: r.profilePath })),
    };
  });

  // ── POST /people — aimer une personne. Sans personId (flux casting
  //    Jellyfin, qui ne connaît que le NOM), la résolution passe par
  //    /search/person : premier résultat, 404 si TMDB ne connaît pas. ──
  app.post("/people", async (request, reply) => {
    const user = (request as any).user as JellyfinUser;
    const body = likeSchema.parse(request.body);
    let personId = body.personId ?? null;
    let name = body.name.trim();
    let profilePath = body.profilePath ?? null;

    if (!personId) {
      if (!tmdbConfigured()) return reply.status(503).send({ error: "tmdb-not-configured" });
      try {
        const page = await tmdbFetch<{ results?: RawPerson[] }>("/search/person", {
          query: name,
          page: "1",
          include_adult: "false",
        });
        const hit = page.results?.find((p) => !isAdultPerson(p));
        if (!hit) return reply.status(404).send({ error: "person-not-found" });
        personId = hit.id;
        name = hit.name ?? name;
        profilePath = profilePath ?? hit.profile_path ?? null;
      } catch {
        return reply.status(502).send({ error: "tmdb-unreachable" });
      }
    }

    const prisma = getPrisma();
    await prisma.userLikedPerson.upsert({
      where: { jellyfinUserId_personId: { jellyfinUserId: user.userId, personId } },
      create: { jellyfinUserId: user.userId, personId, name, profilePath },
      update: { name, profilePath },
    });
    // La matière change (rangées « Avec X ») : pool et pages jetés, passe
    // rapide tout de suite (quelques secondes, zéro réseau) puis relève
    // complète — la page se reconstruit à chaque écriture du pool.
    await invalidatePool(user.userId);
    void bootstrapPool(user.userId).catch(() => undefined);
    pokePage(user.userId, "people");
    return { ok: true, personId, name };
  });

  // ── DELETE /people/:personId — ne plus aimer (idempotent) ──
  app.delete("/people/:personId", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const personId = Number((request.params as { personId: string }).personId);
    const prisma = getPrisma();
    if (Number.isFinite(personId)) {
      await prisma.userLikedPerson.deleteMany({
        where: { jellyfinUserId: user.userId, personId },
      });
      await invalidatePool(user.userId);
      void bootstrapPool(user.userId).catch(() => undefined);
      pokePage(user.userId, "people");
    }
    return { ok: true };
  });
};
