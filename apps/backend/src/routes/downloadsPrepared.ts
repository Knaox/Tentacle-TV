/**
 * La préparation tenue par le serveur (capacité `offline.serverPrepare`) :
 * le fichier Allégé d'un titre se prépare sur le serveur, que le téléphone soit
 * là ou non, et se lit pendant qu'il s'écrit.
 *
 *   GET    /prepared/:itemId         — le fichier, du début ou d'une plage
 *                                      (`Range: bytes=N-`) ; la préparation
 *                                      démarre au premier appel.
 *   GET    /prepared/:itemId/status  — `{ state, bytes }`, sans rien lancer.
 *   DELETE /prepared/:itemId         — le téléphone n'en veut plus (titre reçu,
 *                                      annulé) : arrêtée et effacée.
 *
 * Mêmes paramètres que `/light` (palier, source, pistes), mêmes droits, mêmes
 * refus (404 générique). `?tag=` est l'étiquette de l'appareil : seule une
 * préparation qu'il a déjà lue lui est reprise par plage (`servedFrom`).
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getTokenFromRequest, requireAuth, type JellyfinUser } from "../middleware/auth";
import { getJellyfinUrl } from "../services/configStore";
import { throttled } from "../services/downloadBandwidth/throttledStream";
import { checkLightRight, checkRemuxRight } from "../services/jellyfinPolicy";
import { parseLightRequest, REMUX_PRESET_ID, type LightRequest } from "../services/offlinePrepare/lightStream";
import { acquirePreparation, prepareRegistry } from "../services/offlinePrepare/offlinePrepare";
import { prepareKey, rangeStart, readerTag, servedFrom } from "../services/offlinePrepare/prepareRules";
import { PreparedTail } from "../services/offlinePrepare/prepareTail";

const RAW_STREAM = { config: { compress: false } } as const;

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ error: "Not found" });
}

interface Allowed {
  token: string;
  userId: string;
  light: LightRequest;
}

/** La demande, si le compte y a droit — sinon `null`, indiscernable d'un titre absent. */
async function allowedRequest(request: FastifyRequest): Promise<Allowed | null> {
  const token = getTokenFromRequest(request);
  const userId = (request as FastifyRequest & { user?: JellyfinUser }).user?.userId;
  const { itemId } = request.params as { itemId: string };
  const light = token ? parseLightRequest(itemId, request.query as Record<string, string | undefined>) : null;
  if (!token || !userId || !light) return null;
  const allowed =
    light.presetId === REMUX_PRESET_ID ? await checkRemuxRight(token, itemId) : await checkLightRight(token, itemId);
  return allowed ? { token, userId, light } : null;
}

export const preparedDownloadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get("/prepared/:itemId", RAW_STREAM, async (request, reply) => {
    const allowed = await allowedRequest(request);
    const jellyfinUrl = getJellyfinUrl();
    if (allowed === null || !jellyfinUrl) return notFound(reply);
    const key = prepareKey(allowed.userId, allowed.light);
    const job = acquirePreparation(key, allowed.userId, allowed.light, allowed.token, jellyfinUrl);
    const tag = readerTag((request.query as Record<string, string | undefined>).tag);
    const known = tag !== null && job.readerTags.has(tag);
    if (tag !== null) job.readerTags.add(tag);
    const from = servedFrom(rangeStart(request.headers.range), job, known);
    job.lastAccessAt = Date.now();

    reply.header("x-accel-buffering", "no");
    reply.header("content-type", "video/mp4");
    reply.header("accept-ranges", "bytes");
    reply.header("etag", `"${job.id}"`);
    reply.header("x-tentacle-prepare-state", job.state);
    if (job.state === "done") {
      reply.header("content-length", String(job.bytes - from));
      if (from > 0) reply.header("content-range", `bytes ${from}-${job.bytes - 1}/${job.bytes}`);
    }
    reply.status(from > 0 ? 206 : 200);
    const tail = new PreparedTail(job, from, (closed) => prepareRegistry.settle(closed));
    return reply.send(throttled(request, tail));
  });

  app.get("/prepared/:itemId/status", async (request, reply) => {
    const allowed = await allowedRequest(request);
    if (allowed === null) return notFound(reply);
    const job = prepareRegistry.find(prepareKey(allowed.userId, allowed.light));
    if (job === null || job.released) return { state: "none", bytes: 0 };
    return { state: job.state, bytes: job.bytes };
  });

  app.delete("/prepared/:itemId", async (request, reply) => {
    const allowed = await allowedRequest(request);
    if (allowed === null) return notFound(reply);
    prepareRegistry.release(prepareKey(allowed.userId, allowed.light));
    return reply.status(204).send();
  });
};
