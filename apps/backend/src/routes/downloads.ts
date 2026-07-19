/**
 * Routes de téléchargement (desktop) — GARDE SYSTÉMATIQUE côté backend.
 *
 * Chaque démarrage/reprise re-vérifie EN DIRECT la policy Jellyfin de
 * l'utilisateur (via SON token). Refus = 404 générique `{ error: "Not found" }`
 * — indiscernable d'une ressource inexistante : un compte sans droit ne doit
 * jamais apprendre que la fonctionnalité existe.
 *
 * Le pipe utilise le fetch global (keep-alive Node) : un téléchargement est
 * UNE connexion longue, pas une rafale de segments — le pool undici du proxy
 * n'apporterait rien ici, et le timeout d'inactivité par défaut (~5 min sans
 * octet) est une protection bienvenue contre les flux morts.
 * Jellyfin re-vérifie lui-même `EnableContentDownloading` sur /Download
 * (double enforcement, vérifié source v10.11.11).
 */

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { requireAuth, getTokenFromRequest } from "../middleware/auth";
import { getJellyfinUrl } from "../services/configStore";
import {
  checkDownloadRight,
  checkLightRight,
  getDownloadCapabilities,
  mediaBrowserAuthHeader,
} from "../services/jellyfinPolicy";

const ITEM_ID_RE = /^[0-9a-fA-F-]{32,36}$/;

/** Presets du mode Allégé — miroir de `apps/web/src/downloads/presets.ts`. */
const LIGHT_PRESETS: Record<string, { videoBitRate: number; audioBitRate: number; maxHeight: number }> = {
  p1080: { videoBitRate: 8_000_000, audioBitRate: 192_000, maxHeight: 1080 },
  p720: { videoBitRate: 4_000_000, audioBitRate: 160_000, maxHeight: 720 },
  p480: { videoBitRate: 1_500_000, audioBitRate: 128_000, maxHeight: 480 },
};

/** En-têtes amont relayés tels quels vers le client (Range compris). */
const RELAYED_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "content-disposition",
  "etag",
  "last-modified",
] as const;

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ error: "Not found" });
}

export const downloadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** Capacités de l'utilisateur courant. Sans droit → tout à false,
   *  indiscernable d'une fonctionnalité désactivée côté serveur. */
  app.get("/capabilities", async (request) => {
    const token = getTokenFromRequest(request);
    if (!token) return { downloads: false, lightDownloads: false };
    return getDownloadCapabilities(token);
  });

  /** Fichier original — pipe de `GET /Items/{id}/Download` (Range passthrough). */
  app.get("/original/:itemId", async (request, reply) => {
    const token = getTokenFromRequest(request);
    const { itemId } = request.params as { itemId: string };
    if (!token || !ITEM_ID_RE.test(itemId)) return notFound(reply);
    if (!(await checkDownloadRight(token, itemId))) return notFound(reply);

    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) return notFound(reply);

    const headers: Record<string, string> = {
      Authorization: mediaBrowserAuthHeader(token),
    };
    const range = request.headers.range;
    if (typeof range === "string" && range) headers.Range = range;

    let upstream: Response;
    try {
      upstream = await fetch(`${jellyfinUrl}/Items/${itemId}/Download`, { headers });
    } catch {
      return notFound(reply);
    }
    if ((upstream.status !== 200 && upstream.status !== 206) || !upstream.body) {
      return notFound(reply);
    }

    reply.status(upstream.status);
    for (const name of RELAYED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) reply.header(name, value);
    }
    return reply.send(
      Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream),
    );
  });

  /** Mode Allégé — flux transcodé progressif fMP4 (`stream.mp4?static=false`,
   *  fragmenté par Jellyfin : `frag_keyframe+empty_moov`, fichier valide une
   *  fois complet — vérifié source v10.11.11). Pas de Range possible sur un
   *  transcode : toute reprise repart de zéro (géré côté moteur desktop).
   *  Le droit appliqué ICI est `EnableMediaConversion` (Jellyfin ne l'enforce
   *  pas lui-même) + les droits de transcodage de lecture. */
  app.get("/light/:itemId", async (request, reply) => {
    const token = getTokenFromRequest(request);
    const { itemId } = request.params as { itemId: string };
    const query = request.query as Record<string, string | undefined>;
    const preset = LIGHT_PRESETS[query.preset ?? "p720"];
    if (!token || !ITEM_ID_RE.test(itemId) || !preset) return notFound(reply);
    if (!(await checkLightRight(token, itemId))) return notFound(reply);

    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) return notFound(reply);

    // Session de transcodage dédiée — renvoyée au client pour l'arrêt propre
    // (DELETE Videos/ActiveEncodings via le proxy) à toute fin de transfert.
    const playSessionId = randomUUID();
    const deviceId = `tentacle-dl-${playSessionId.slice(0, 8)}`;
    const params = new URLSearchParams({
      static: "false",
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      videoBitRate: String(preset.videoBitRate),
      audioBitRate: String(preset.audioBitRate),
      maxHeight: String(preset.maxHeight),
      deviceId,
      playSessionId,
      // Copie de flux autorisée sous le plafond de débit : une source déjà
      // h264/aac plus légère que le preset est remuxée sans réencodage.
      allowVideoStreamCopy: "true",
      allowAudioStreamCopy: "true",
    });
    const mediaSourceId = query.mediaSourceId;
    if (mediaSourceId && ITEM_ID_RE.test(mediaSourceId)) {
      params.set("mediaSourceId", mediaSourceId);
    }
    const audioIndex = Number.parseInt(query.audioStreamIndex ?? "", 10);
    if (Number.isInteger(audioIndex) && audioIndex >= 0 && audioIndex < 1000) {
      params.set("audioStreamIndex", String(audioIndex));
    }
    const burnIndex = Number.parseInt(query.burnSubtitleIndex ?? "", 10);
    if (Number.isInteger(burnIndex) && burnIndex >= 0 && burnIndex < 1000) {
      params.set("subtitleStreamIndex", String(burnIndex));
      params.set("subtitleMethod", "Encode");
    }

    let upstream: Response;
    try {
      upstream = await fetch(`${jellyfinUrl}/Videos/${itemId}/stream.mp4?${params.toString()}`, {
        headers: { Authorization: mediaBrowserAuthHeader(token) },
      });
    } catch {
      return notFound(reply);
    }
    if (upstream.status !== 200 || !upstream.body) return notFound(reply);

    reply.status(200);
    reply.header("content-type", upstream.headers.get("content-type") ?? "video/mp4");
    reply.header("x-tentacle-play-session", playSessionId);
    reply.header("x-tentacle-device-id", deviceId);
    return reply.send(
      Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream),
    );
  });
};
