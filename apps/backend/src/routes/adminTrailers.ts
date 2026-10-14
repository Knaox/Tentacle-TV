/* ------------------------------------------------------------------ */
/*  Les bandes-annonces vues par l'administration (onglet Métadonnées)  */
/*                                                                     */
/*  GET /api/admin/trailers                                            */
/*    → { allocine, allocineAvailable, language, sources: { youtube,   */
/*        dailymotion } }                                              */
/*  PUT /api/admin/trailers { allocine: boolean } → { ok: true }       */
/*                                                                     */
/*  `allocine` : la case (absente de la base = cochée).                */
/*  `allocineAvailable` : la langue du serveur — celle des métadonnées */
/*  de Jellyfin, `language` — lui convient (le français) ; sinon la    */
/*  case est grisée et dit pourquoi. `sources` : chaque source         */
/*  « normale » ou « en pause jusqu'à … » et pourquoi (garde-fous).    */
/* ------------------------------------------------------------------ */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { refreshTitleLanguage, titleLanguage } from "../services/reco/titleLanguage";
import { dailymotionGuardStatus } from "../services/trailers/dailymotionGuard";
import { allocineSuitsLanguage, isAllocineEnabled, setAllocineEnabled } from "../services/trailers/trailerSettings";
import { youtubeGuardStatus } from "../services/trailers/youtubeGuard";

const putSchema = z.object({ allocine: z.boolean() });

const primary = (lang: string | null) => (lang ? lang.slice(0, 2).toLowerCase() : null);

export const adminTrailersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.get("/trailers", async () => {
    const language = primary(await refreshTitleLanguage().catch(() => titleLanguage()));
    return {
      allocine: isAllocineEnabled(),
      allocineAvailable: allocineSuitsLanguage(language),
      language,
      sources: { youtube: youtubeGuardStatus(), dailymotion: dailymotionGuardStatus() },
    };
  });

  app.put("/trailers", async (request, reply) => {
    const parsed = putSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid_request" });
    await setAllocineEnabled(parsed.data.allocine);
    return { ok: true };
  });
};
