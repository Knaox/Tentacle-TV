import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { pokeProfile } from "../services/reco/jobs";
import { buildDeck } from "../services/swipe/deckService";
import { cardDetails } from "../services/swipe/cardDetails";
import { deleteSwipe, saveSwipe } from "../services/swipe/swipeStore";
import { SWIPE_VERDICTS } from "../services/swipe/swipeTypes";

const mediaType = z.enum(["movie", "tv"]);
const lang = z.enum(["fr", "en"]).catch("fr");

const deckQuery = z.object({
  lang,
  limit: z.coerce.number().int().min(1).max(40).catch(20),
  // « movie:603,tv:1399 » — les cartes que le client tient déjà.
  exclude: z
    .string()
    .optional()
    .transform((v) => (v ?? "").split(",").filter((k) => /^(movie|tv):\d+$/.test(k)).slice(0, 80)),
});

const judgeBody = z.object({
  mediaType,
  tmdbId: z.coerce.number().int().positive(),
  verdict: z.enum(SWIPE_VERDICTS),
});

const titleParams = z.object({ mediaType, tmdbId: z.coerce.number().int().positive() });

const detailsQuery = z.object({
  lang,
  itemId: z
    .string()
    .regex(/^[0-9a-f]{32}$/i)
    .optional()
    .catch(undefined),
});

/**
 * Onglet « Affiner » : une pile de films et séries à juger (like, super
 * like, dislike, passer). Les verdicts nourrissent le moteur de
 * recommandations — le profil se reconstruit derrière (poke débouncé).
 * TMDB n'est appelé que d'ici : sa clé ne quitte jamais le serveur.
 */
export const swipeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // ── GET /deck — la prochaine salve de cartes ──
  app.get("/deck", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const q = deckQuery.parse(request.query);
    return buildDeck(user.userId, { lang: q.lang, size: q.limit, exclude: q.exclude });
  });

  // ── POST / — pose un verdict (le dernier geste sur un titre gagne) ──
  app.post("/", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const body = judgeBody.parse(request.body);
    await saveSwipe(user.userId, body.mediaType, body.tmdbId, body.verdict);
    if (body.verdict !== "skip") pokeProfile(user.userId);
    return { ok: true };
  });

  // ── DELETE /:mediaType/:tmdbId — annule le verdict (idempotent) ──
  app.delete("/:mediaType/:tmdbId", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const params = titleParams.parse(request.params);
    const removed = await deleteSwipe(user.userId, params.mediaType, params.tmdbId);
    if (removed) pokeProfile(user.userId);
    return { ok: true, removed };
  });

  // ── GET /details/:mediaType/:tmdbId — le verso d'une carte ──
  app.get("/details/:mediaType/:tmdbId", async (request) => {
    const user = (request as any).user as JellyfinUser;
    const params = titleParams.parse(request.params);
    const q = detailsQuery.parse(request.query);
    return cardDetails(user.userId, params.mediaType, params.tmdbId, q.lang, q.itemId ?? null);
  });
};
