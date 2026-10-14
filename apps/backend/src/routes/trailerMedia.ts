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
import type { Response as UpstreamResponse } from "undici";
import { requestSignal } from "./jellyfinProxy/clientAbort";
import { cutoffReason } from "./jellyfinProxy/streamLog";
import { relayTokenExpiry, relayTokenScope, type RelayScope } from "../services/trailers/relayToken";
import {
  TOKEN_SLOT, fetchUpstream, masterTemplate, mediaTemplate, progressiveTarget, relayAttempts, segmentTarget,
} from "../services/trailers/trailerRelay";
import { subtitleVtt } from "../services/trailers/trailerSubtitleRelay";
import { heldSegment, type HeldSegment } from "../services/trailers/trailerSegments";

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const KEY_RE = /^[\w-]{1,16}$/;
/** `master.m3u8` (« Auto »), ou `master-720.m3u8` : le maître réduit à une qualité. */
const MASTER_RE = /^master(?:-(\d{3,4}))?\.m3u8$/;
/** Une piste de sous-titres : `m-en-US.vtt`, `a-en.vtt` (trailerSubtitles.ts). */
const SUBTITLE_RE = /^([ma]-[a-zA-Z0-9-]{2,24})\.vtt$/;
const HLS_MIME = "application/vnd.apple.mpegurl";

/** Un segment de quelques secondes arrive en bien moins ; un MP4 entier peut prendre son temps. */
const SEGMENT_TIMEOUT_MS = 60_000;
const FILE_TIMEOUT_MS = 10 * 60_000;

type Params = { ytId: string; name?: string; key?: string };

/** La vidéo `ytId`, si le jeton de la requête l'ouvre ; sinon la réponse est déjà partie. */
/**
 * La vidéo `ytId` et la portée du jeton qui l'ouvre ; sinon la réponse est
 * déjà partie. Un jeton d'APERÇU ne fait jamais ré-extraire : la vidéo que le
 * relais a oubliée répond 404, et le client redemande `/preview` — gardé.
 */
function authorize(ytId: string, request: FastifyRequest, reply: FastifyReply): { ytId: string; token: string; scope: RelayScope } | null {
  const { t } = request.query as { t?: string };
  const scope = YT_ID_RE.test(ytId) ? relayTokenScope(ytId, t) : null;
  if (!scope) {
    reply.status(403).send({ error: "forbidden" });
    return null;
  }
  return { ytId, token: t as string, scope };
}

type Access = { token: string; scope: RelayScope };

/** Le temps (s) qu'un navigateur garde ce que sert un jeton d'aperçu : jusqu'à une minute avant son échéance, une heure au plus. */
function previewKeepS(token: string, now: number): number {
  const expiry = relayTokenExpiry(token);
  return expiry === null ? 0 : Math.min(3600, Math.floor((expiry - now) / 1000) - 60);
}

/**
 * Le cache d'une liste relayée. Ses URI portent le jeton : jamais dans un
 * cache intermédiaire (`private`). Pour un APERÇU, le navigateur la garde
 * jusqu'à une minute avant l'échéance du jeton (une heure au plus) — et
 * `immutable` : elle ne change jamais sous ce jeton (un jeton d'aperçu ne
 * fait jamais ré-extraire), un retour sur la carte ne la revalide même pas.
 * Une lecture (TV) ne garde rien : une nouvelle extraction peut changer ses
 * variantes.
 */
export function playlistCacheControl(access: Access, now = Date.now()): string {
  if (access.scope !== "preview") return "private, no-store";
  const seconds = previewKeepS(access.token, now);
  return seconds > 0 ? `private, max-age=${seconds}, immutable` : "private, no-store";
}

/**
 * Le cache d'un segment (ou du MP4) relayé : une heure, comme toujours ; pour
 * un APERÇU, `immutable` jusqu'à l'échéance de son jeton — chaque segment se
 * télécharge une fois par titre et par page, les survols suivants le relisent.
 */
export function mediaCacheControl(access: Access, now = Date.now()): string {
  if (access.scope !== "preview") return "private, max-age=3600";
  const seconds = previewKeepS(access.token, now);
  return seconds > 0 ? `private, max-age=${seconds}, immutable` : "private, no-store";
}

function sendPlaylist(reply: FastifyReply, template: string | null, access: Access) {
  if (template === null) return reply.status(404).send({ error: "unavailable" });
  reply.header("Cache-Control", playlistCacheControl(access));
  reply.type(HLS_MIME);
  return reply.send(template.split(TOKEN_SLOT).join(access.token));
}

/**
 * Relaie une réponse amont (statut, type, longueur, plage) vers AVPlayer. Un
 * refus PASSAGER de googlevideo (503, 429…) passe tel quel mais n'est jamais
 * gardé : immuable dans le cache du navigateur, il aurait été resservi à la
 * reprise du lecteur au lieu d'être redemandé.
 */
function relay(reply: FastifyReply, res: UpstreamResponse, fallbackType: string, access: Access) {
  if (!res.body) return reply.status(502).send({ error: "upstream" });
  reply.status(res.status);
  reply.header("Content-Type", res.headers.get("content-type") ?? fallbackType);
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = res.headers.get(name);
    if (value) reply.header(name, value);
  }
  reply.header("Cache-Control", res.ok ? mediaCacheControl(access) : "private, no-store");
  return reply.send(Readable.fromWeb(res.body as import("stream/web").ReadableStream));
}

/**
 * Les octets vidéo ne se recompressent pas : googlevideo dit ses segments
 * `application/octet-stream`, que la compression globale tient pour
 * compressible — chaque segment partait en zstd pour un navigateur, du calcul
 * pour rien sur de la vidéo déjà compressée.
 */
const VIDEO_BYTES = { compress: false } as const;

/**
 * Une lecture amont qui n'aboutit pas. Le lecteur parti (survol fini, saut,
 * aperçu refermé) n'est pas une erreur : personne n'attend de réponse, comme
 * au proxy de Jellyfin. Une panne amont se dit en 504 / 502, sans 500.
 */
function upstreamFailure(request: FastifyRequest, reply: FastifyReply, err: unknown) {
  const cause = cutoffReason(err);
  if (cause === "annule") return reply;
  request.log.warn({ cause }, "[trailers] relais : lecture amont en échec");
  return reply.status(cause === "delai-absolu" ? 504 : 502).send({ error: "upstream" });
}

/** Un premier segment lu d'avance par l'aperçu (`trailerSegments.ts`), servi de la mémoire. */
function sendHeld(reply: FastifyReply, segment: HeldSegment, access: Access) {
  reply.header("Content-Type", segment.contentType);
  reply.header("Cache-Control", mediaCacheControl(access));
  return reply.send(segment.body);
}

export async function trailerMediaRoutes(app: FastifyInstance) {
  app.get<{ Params: Params }>("/hls/:ytId/:name", async (request, reply) => {
    const access = authorize(request.params.ytId, request, reply);
    if (!access) return reply;
    const match = MASTER_RE.exec(request.params.name ?? "");
    if (!match) return reply.status(404).send({ error: "unknown" });
    const height = match[1] ? Number(match[1]) : undefined;
    return sendPlaylist(reply, await masterTemplate(access.ytId, height, access.scope), access);
  });

  app.get<{ Params: Params }>("/subs/:ytId/:name", async (request, reply) => {
    const access = authorize(request.params.ytId, request, reply);
    if (!access) return reply;
    const key = SUBTITLE_RE.exec(request.params.name ?? "")?.[1];
    if (!key) return reply.status(404).send({ error: "unknown" });
    const vtt = await subtitleVtt(access.ytId, key, access.scope);
    if (vtt === null) return reply.status(404).send({ error: "unavailable" });
    reply.header("Cache-Control", "private, max-age=3600");
    reply.type("text/vtt; charset=utf-8");
    return reply.send(vtt);
  });

  app.get<{ Params: Params }>("/hls/:ytId/p/:name", async (request, reply) => {
    const access = authorize(request.params.ytId, request, reply);
    if (!access) return reply;
    const key = request.params.name?.replace(/\.m3u8$/, "") ?? "";
    if (!KEY_RE.test(key)) return reply.status(404).send({ error: "unknown" });
    return sendPlaylist(reply, await mediaTemplate(access.ytId, key, access.scope), access);
  });

  app.get<{ Params: Params }>("/hls/:ytId/s/:key/:name", VIDEO_BYTES, async (request, reply) => {
    const access = authorize(request.params.ytId, request, reply);
    if (!access) return reply;
    const { key = "", name = "" } = request.params;
    const index = name === "init.mp4" ? "init" : Number(/^(\d+)\.ts$/.exec(name)?.[1] ?? NaN);
    if (!KEY_RE.test(key) || (index !== "init" && !Number.isInteger(index))) return reply.status(404).send({ error: "unknown" });

    // Lu d'avance par l'aperçu : servi de la mémoire, ou à la fin de la lecture déjà en route.
    const early = request.headers.range ? null : heldSegment(access.ytId, key, index);
    const segment = early ? await early : null;
    if (segment) return sendHeld(reply, segment, access);

    const signal = requestSignal(request, reply, SEGMENT_TIMEOUT_MS);
    try {
      // Une URL refusée (échéance, révocation) : une nouvelle extraction, une seule fois — jamais pour un aperçu.
      for (const attempt of relayAttempts(access.scope)) {
        const target = await segmentTarget(access.ytId, key, index, attempt);
        if (!target) break;
        const { res, refused } = await fetchUpstream(target.url, target.headers, { signal });
        if (refused && !attempt.fresh) {
          await res.body?.cancel();
          continue;
        }
        return relay(reply, res, index === "init" ? "video/mp4" : "video/mp2t", access);
      }
    } catch (err) {
      return upstreamFailure(request, reply, err);
    }
    return reply.status(404).send({ error: "unavailable" });
  });

  app.get<{ Params: Params }>("/file/:name", VIDEO_BYTES, async (request, reply) => {
    const access = authorize(request.params.name?.replace(/\.mp4$/, "") ?? "", request, reply);
    if (!access) return reply;
    const signal = requestSignal(request, reply, FILE_TIMEOUT_MS);
    // AVPlayer lit un MP4 par plages : chacune est relayée telle quelle.
    const range = typeof request.headers.range === "string" ? request.headers.range : undefined;
    try {
      for (const attempt of relayAttempts(access.scope)) {
        const target = await progressiveTarget(access.ytId, attempt);
        if (!target) break;
        const { res, refused } = await fetchUpstream(target.url, target.headers, { signal, range });
        if (refused && !attempt.fresh) {
          await res.body?.cancel();
          continue;
        }
        return relay(reply, res, "video/mp4", access);
      }
    } catch (err) {
      return upstreamFailure(request, reply, err);
    }
    return reply.status(404).send({ error: "unavailable" });
  });
}
