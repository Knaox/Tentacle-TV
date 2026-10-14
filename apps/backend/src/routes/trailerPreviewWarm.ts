/* ------------------------------------------------------------------ */
/*  La préparation des aperçus des titres à l'écran                    */
/*                                                                     */
/*  POST /api/trailers/preview/warm  { subjects, lang?, dailymotion? } */
/*                                                                     */
/*  Le client dit les titres que ses cartes montrent ; le serveur rend */
/*  tout de suite les aperçus DÉJÀ prêts (le corps même de             */
/*  `GET /preview`) et prépare les autres en fond (`previewWarm.ts` :  */
/*  jamais d'extraction YouTube). Contrat : packages/shared/src/       */
/*  trailers/trailerPreviewWarm.ts, recopié dans src/trailers/. Tout   */
/*  compte connecté y a droit, comme à `GET /preview` — un titre de la */
/*  bibliothèque n'est rendu qu'à un compte qui le voit. Un seau par   */
/*  compte : dix demandes d'avance, puis une toutes les deux secondes. */
/* ------------------------------------------------------------------ */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { resolveCatalogTitle } from "../services/trailers/catalog/catalogTitle";
import { previewBody } from "../services/trailers/preview/previewBody";
import { previewLanguage } from "../services/trailers/preview/previewLanguage";
import { decisionKey } from "../services/trailers/preview/previewSteps";
import { readyPreview, warmPreviews, type WarmJob } from "../services/trailers/preview/previewWarm";
import { TokenBuckets } from "../services/trailers/sourceGuard";
import { prewarmExtraction } from "../services/trailers/ytExtract";
import { previewRefusal } from "../services/trailers/youtubeGuard";
import type { TrailerPreviewRefusalBody } from "../trailers/trailerPreview";
import {
  parseTrailerPreviewWarmBody, type TrailerPreviewWarmReady, type TrailerPreviewWarmResponse, type TrailerPreviewWarmSubject,
} from "../trailers/trailerPreviewWarm";
import { previewTarget } from "./trailerPreview";

const limiter = new TokenBuckets(10, 2_000);

function refuse(reply: FastifyReply, status: 400 | 429, body: TrailerPreviewRefusalBody) {
  return reply.status(status).send(body);
}

/** Ce que la demande fait d'un titre : un aperçu prêt à rendre, une préparation, ou rien (invisible pour ce compte). */
type Plan = { kind: "ready"; ready: TrailerPreviewWarmReady } | { kind: "warm"; job: WarmJob } | { kind: "none" };

async function planFor(subject: TrailerPreviewWarmSubject, lang: string | undefined, dailymotion: boolean, userId: string): Promise<Plan> {
  const target = previewTarget(subject, lang);
  const key = decisionKey(target, lang, dailymotion);
  const ready = readyPreview(key);
  if (!ready) return { kind: "warm", job: { key, target, lang, account: userId, dailymotion } };
  // Une décision est partagée par tous ceux qui voient le titre : jamais rendue à un compte qui ne le voit pas.
  if ("itemId" in subject && (await resolveCatalogTitle(subject.itemId, userId)).kind !== "title") return { kind: "none" };
  return { kind: "ready", ready: { subject, preview: previewBody(ready.ref, ready.resolved, ready.version) } };
}

export const trailerPreviewWarmRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.post("/preview/warm", async (request: FastifyRequest, reply: FastifyReply) => {
    // Des jetons d'accès voyagent dans la réponse : aucun cache intermédiaire ne la garde.
    reply.header("Cache-Control", "private, no-store");
    const body = parseTrailerPreviewWarmBody(request.body);
    if (!body) return refuse(reply, 400, { error: "invalid_request" });
    const { userId } = (request as FastifyRequest & { user: JellyfinUser }).user;
    const wait = limiter.take(userId);
    if (wait > 0) {
      const retryAfterS = Math.max(1, Math.ceil(wait / 1000));
      reply.header("Retry-After", String(retryAfterS));
      return refuse(reply, 429, { error: "rate_limited", retryAfterS });
    }
    // Quelqu'un parcourt des titres : un survol suivra sans doute — l'ouvrier yt-dlp se garde chaud.
    if (!previewRefusal()) prewarmExtraction();
    const lang = await previewLanguage(body.lang);
    const dailymotion = body.dailymotion === true;
    const plans = await Promise.all(body.subjects.map((subject) => planFor(subject, lang, dailymotion, userId)));
    const response: TrailerPreviewWarmResponse = {
      ready: plans.flatMap((plan) => (plan.kind === "ready" ? [plan.ready] : [])),
      queued: warmPreviews(plans.flatMap((plan) => (plan.kind === "warm" ? [plan.job] : []))),
    };
    return response;
  });
};

/** Pour les tests. */
export function resetPreviewWarmLimiter(): void {
  limiter.reset();
}
