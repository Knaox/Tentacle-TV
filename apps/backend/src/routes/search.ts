import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { browseFacet, browsePerson, discover } from "../services/search/browse";
import { searchEpisodes } from "../services/search/jellyfinSearch";
import { runSearch } from "../services/search/searchService";

/**
 * Le moteur de recherche Tentacle (`services/search/`).
 *
 * - `GET /?q=&limit=` : titres, personnes, genres — en mémoire, aucune requête
 *   vers Jellyfin par frappe ;
 * - `GET /episodes?q=&limit=` : les épisodes, demandés à Jellyfin À PART pour
 *   ne jamais retarder le reste ;
 * - `GET /person/:id`, `GET /genre?name=`, `GET /studio?name=` : une
 *   filmographie, un genre, un studio ;
 * - `GET /discover` : les genres à proposer quand la barre est vide.
 *
 * Tout est au nom du compte connecté : ses droits Jellyfin filtrent chaque
 * réponse. Réponses privées, jamais mises en cache par un intermédiaire.
 */

const QUERY = z.object({
  q: z.string().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(60).default(6),
});
const BROWSE = z.object({ limit: z.coerce.number().int().min(1).max(200).default(60) });
const PERSON = z.object({ id: z.string().regex(/^[0-9a-fA-F-]{32,36}$/) });
const FACET = z.object({
  name: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});

function userOf(request: unknown): JellyfinUser {
  return (request as { user: JellyfinUser }).user;
}

function privateReply(reply: FastifyReply): FastifyReply {
  return reply.header("Cache-Control", "private, no-store");
}

export const searchRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/", async (request, reply) => {
    const parsed = QUERY.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid-query" });
    const { q, limit } = parsed.data;
    return privateReply(reply).send(await runSearch(userOf(request).userId, q, limit));
  });

  app.get("/episodes", async (request, reply) => {
    const parsed = QUERY.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: "invalid-query" });
    const { q, limit } = parsed.data;
    // Sous trois lettres, `searchTerm` rendrait la moitié de la bibliothèque.
    if (q.trim().length < 3) return privateReply(reply).send({ query: q, episodes: [] });
    const episodes = await searchEpisodes(userOf(request).userId, q.trim(), limit).catch(() => []);
    return privateReply(reply).send({ query: q, episodes });
  });

  app.get("/person/:id", async (request, reply) => {
    const params = PERSON.safeParse(request.params);
    const query = BROWSE.safeParse(request.query);
    if (!params.success || !query.success) return reply.status(400).send({ error: "invalid-query" });
    const result = await browsePerson(userOf(request).userId, params.data.id, query.data.limit);
    if (result === null) return reply.status(404).send({ error: "not-found" });
    return privateReply(reply).send(result);
  });

  for (const kind of ["genre", "studio"] as const) {
    app.get(`/${kind}`, async (request, reply) => {
      const parsed = FACET.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: "invalid-query" });
      const result = await browseFacet(userOf(request).userId, kind, parsed.data.name, parsed.data.limit);
      if (result === null) return reply.status(404).send({ error: "not-found" });
      return privateReply(reply).send(result);
    });
  }

  app.get("/discover", async (request, reply) => {
    return privateReply(reply).send(await discover(userOf(request).userId, 12));
  });
};
