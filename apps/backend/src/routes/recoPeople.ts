import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { generatePool } from "../services/reco/generationJob";
import { invalidatePool } from "../services/reco/poolStore";
import { tmdbConfigured, tmdbFetch } from "../services/tmdb/client";

interface RawPerson {
  id: number;
  name?: string;
  profile_path?: string | null;
  known_for?: Array<{ title?: string; name?: string }>;
}

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
      });
      return {
        results: (page.results ?? []).slice(0, 8).map((p) => ({
          personId: p.id,
          name: p.name ?? "",
          profilePath: p.profile_path ?? null,
          knownFor: (p.known_for ?? [])
            .map((k) => k.title ?? k.name ?? "")
            .filter(Boolean)
            .slice(0, 3),
        })),
      };
    } catch {
      return { results: [] };
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
        });
        const hit = page.results?.[0];
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
    await invalidatePool(user.userId);
    void generatePool(user.userId).catch(() => undefined);
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
      void generatePool(user.userId).catch(() => undefined);
    }
    return { ok: true };
  });
};
