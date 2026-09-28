import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import {
  affinityCards, affinityKinds, currentAffinity, joinAffinity, launchAffinity, leaveAffinity,
  startAffinity, undoAffinityVote, voteAffinity, type AffinityResult,
} from "../services/watchTogether/affinity/affinityService";

/**
 * Watch Together — l'AFFINITÉ, le swipe de groupe (REST, même préfixe
 * /api/watch-together). Les gestes montent ici ; l'état redescend à toute la
 * salle par le socket (`wt:affinity`).
 *
 * Réservé aux membres d'une salle ; lancer exige au moins deux membres. Les
 * cartes ne sont jamais que des titres de la bibliothèque que tout le groupe
 * peut lire — jamais hors bibliothèque, jamais Vigie.
 */

const kind = z.enum(["movie", "series", "anime"]);
const verdict = z.enum(["like", "dislike"]);
const titleKey = z.string().regex(/^(movie|tv):\d{1,10}$/);
const sessionId = z.coerce.number().int().positive();
const limit = z.coerce.number().int().min(1).max(30).catch(12);

const cardsQuery = z.object({
  sessionId,
  limit,
  // « movie:603,tv:1399 » — les cartes que le client tient déjà.
  exclude: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").filter((k) => titleKey.safeParse(k).success).slice(0, 60)),
});

function user(request: unknown): JellyfinUser {
  return (request as { user: JellyfinUser }).user;
}

/** Le résultat d'un geste : sa valeur, ou le code métier et son statut. */
function reply<T>(res: FastifyReply, result: AffinityResult<T>): T | FastifyReply {
  if (result.ok) return result.value;
  return res.status(result.status).send({ code: result.code });
}

export const watchTogetherAffinityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** GET /affinity — la séance de la salle (reprise au montage), ou null. */
  app.get("/affinity", async (request) => ({ state: currentAffinity(user(request).userId) }));

  /** GET /affinity/kinds — titres de chaque type que tout le groupe peut lire. */
  app.get("/affinity/kinds", async (request, res) => {
    const result = await affinityKinds(user(request).userId);
    return result.ok ? { counts: result.value } : reply(res, result);
  });

  /** POST /affinity — lance la séance, ou change de type. */
  app.post("/affinity", async (request, res) => {
    const body = z.object({ kind }).parse(request.body);
    const result = await startAffinity(user(request).userId, body.kind);
    return result.ok ? { state: result.value } : reply(res, result);
  });

  /** POST /affinity/join — rejoint la séance, rend les premières cartes. */
  app.post("/affinity/join", async (request, res) => {
    const body = z.object({ limit }).parse(request.body ?? {});
    return reply(res, await joinAffinity(user(request).userId, body.limit));
  });

  /** POST /affinity/leave — ne plus participer (ses votes partent). */
  app.post("/affinity/leave", async (request, res) => {
    const result = leaveAffinity(user(request).userId);
    return result.ok ? { ok: true } : reply(res, result);
  });

  /** GET /affinity/cards — la suite de ma pile. */
  app.get("/affinity/cards", async (request, res) => {
    const q = cardsQuery.parse(request.query);
    const result = affinityCards(user(request).userId, q.sessionId, q.limit, q.exclude);
    return result.ok ? { sessionId: q.sessionId, cards: result.value } : reply(res, result);
  });

  /** POST /affinity/votes — un verdict sur une carte : j'aime ou pas pour moi. */
  app.post("/affinity/votes", async (request, res) => {
    const body = z.object({ sessionId, key: titleKey, verdict }).parse(request.body);
    return reply(res, voteAffinity(user(request).userId, body.sessionId, body.key, body.verdict));
  });

  /** DELETE /affinity/votes/:key?sessionId= — annule mon geste. */
  app.delete("/affinity/votes/:key", async (request, res) => {
    const { key } = z.object({ key: titleKey }).parse(request.params);
    const q = z.object({ sessionId }).parse(request.query);
    const result = undoAffinityVote(user(request).userId, q.sessionId, key);
    return result.ok ? { ok: true } : reply(res, result);
  });

  /** POST /affinity/launch — un match part en lecture pour le groupe. */
  app.post("/affinity/launch", async (request, res) => {
    const body = z.object({ key: titleKey }).parse(request.body);
    const result = launchAffinity(user(request).userId, body.key);
    return result.ok ? { ok: true } : reply(res, result);
  });
};
