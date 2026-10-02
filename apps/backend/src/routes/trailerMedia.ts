/* ------------------------------------------------------------------ */
/*  Les flux relayés des bandes-annonces (HLS et MP4 de repli)         */
/*                                                                     */
/*  Ce qu'AVPlayer demande après `/api/trailers/resolve` : le maître,  */
/*  les listes, les segments — servis par ce serveur, relus chez       */
/*  googlevideo à la demande. Pas de requireAuth : AVPlayer ne pose    */
/*  pas d'en-tête d'autorisation. Le jeton de l'URL (relayToken.ts)    */
/*  lie chaque requête à UNE vidéo qu'un compte connecté a résolue.    */
/* ------------------------------------------------------------------ */

import { Readable } from "stream";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requestSignal } from "./jellyfinProxy/clientAbort";
import { verifyRelayToken } from "../services/trailers/relayToken";
import {
  TOKEN_SLOT, fetchUpstream, masterTemplate, mediaTemplate, progressiveTarget, segmentTarget,
} from "../services/trailers/trailerRelay";

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const KEY_RE = /^[\w-]{1,16}$/;
const HLS_MIME = "application/vnd.apple.mpegurl";

/** Un segment de quelques secondes arrive en bien moins ; un MP4 entier peut prendre son temps. */
const SEGMENT_TIMEOUT_MS = 60_000;
const FILE_TIMEOUT_MS = 10 * 60_000;

type Params = { ytId: string; name?: string; key?: string };

/** La vidéo `ytId`, si le jeton de la requête l'ouvre ; sinon la réponse est déjà partie. */
function authorize(ytId: string, request: FastifyRequest, reply: FastifyReply): { ytId: string; token: string } | null {
  const { t } = request.query as { t?: string };
  if (!YT_ID_RE.test(ytId) || !verifyRelayToken(ytId, t)) {
    reply.status(403).send({ error: "forbidden" });
    return null;
  }
  return { ytId, token: t as string };
}

function sendPlaylist(reply: FastifyReply, template: string | null, token: string) {
  if (template === null) return reply.status(404).send({ error: "unavailable" });
  // Les URI portent le jeton : rien à garder en cache intermédiaire.
  reply.header("Cache-Control", "private, no-store");
  reply.type(HLS_MIME);
  return reply.send(template.split(TOKEN_SLOT).join(token));
}

/** Relaie une réponse amont (statut, type, longueur, plage) vers AVPlayer. */
function relay(reply: FastifyReply, res: Response, fallbackType: string) {
  if (!res.body) return reply.status(502).send({ error: "upstream" });
  reply.status(res.status);
  reply.header("Content-Type", res.headers.get("content-type") ?? fallbackType);
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = res.headers.get(name);
    if (value) reply.header(name, value);
  }
  reply.header("Cache-Control", "private, max-age=3600");
  return reply.send(Readable.fromWeb(res.body as import("stream/web").ReadableStream));
}

export async function trailerMediaRoutes(app: FastifyInstance) {
  app.get<{ Params: Params }>("/hls/:ytId/master.m3u8", async (request, reply) => {
    const access = authorize(request.params.ytId, request, reply);
    if (!access) return reply;
    return sendPlaylist(reply, await masterTemplate(access.ytId), access.token);
  });

  app.get<{ Params: Params }>("/hls/:ytId/p/:name", async (request, reply) => {
    const access = authorize(request.params.ytId, request, reply);
    if (!access) return reply;
    const key = request.params.name?.replace(/\.m3u8$/, "") ?? "";
    if (!KEY_RE.test(key)) return reply.status(404).send({ error: "unknown" });
    return sendPlaylist(reply, await mediaTemplate(access.ytId, key), access.token);
  });

  app.get<{ Params: Params }>("/hls/:ytId/s/:key/:name", async (request, reply) => {
    const access = authorize(request.params.ytId, request, reply);
    if (!access) return reply;
    const { key = "", name = "" } = request.params;
    const index = name === "init.mp4" ? "init" : Number(/^(\d+)\.ts$/.exec(name)?.[1] ?? NaN);
    if (!KEY_RE.test(key) || (index !== "init" && !Number.isInteger(index))) return reply.status(404).send({ error: "unknown" });

    const signal = requestSignal(request, reply, SEGMENT_TIMEOUT_MS);
    // Une URL refusée (échéance, révocation) : une nouvelle extraction, une seule fois.
    for (const fresh of [false, true]) {
      const target = await segmentTarget(access.ytId, key, index, { fresh });
      if (!target) break;
      const { res, refused } = await fetchUpstream(target.url, target.headers, { signal });
      if (refused && !fresh) {
        await res.body?.cancel();
        continue;
      }
      return relay(reply, res, index === "init" ? "video/mp4" : "video/mp2t");
    }
    return reply.status(404).send({ error: "unavailable" });
  });

  app.get<{ Params: Params }>("/file/:name", async (request, reply) => {
    const access = authorize(request.params.name?.replace(/\.mp4$/, "") ?? "", request, reply);
    if (!access) return reply;
    const signal = requestSignal(request, reply, FILE_TIMEOUT_MS);
    // AVPlayer lit un MP4 par plages : chacune est relayée telle quelle.
    const range = typeof request.headers.range === "string" ? request.headers.range : undefined;
    for (const fresh of [false, true]) {
      const target = await progressiveTarget(access.ytId, { fresh });
      if (!target) break;
      const { res, refused } = await fetchUpstream(target.url, target.headers, { signal, range });
      if (refused && !fresh) {
        await res.body?.cancel();
        continue;
      }
      return relay(reply, res, "video/mp4");
    }
    return reply.status(404).send({ error: "unavailable" });
  });
}
