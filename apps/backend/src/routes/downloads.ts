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
  checkRemuxRight,
  getDownloadCapabilities,
  mediaBrowserAuthHeader,
} from "../services/jellyfinPolicy";
import { throttled } from "../services/downloadBandwidth/throttledStream";
import {
  ITEM_ID_RE,
  lightStreamParams,
  parseLightRequest,
  presetsFor,
  REMUX_PRESET_ID,
} from "../services/offlinePrepare/lightStream";
import { parseAudioLightRequest } from "../services/offlinePrepare/audioLight";
import { serveAudioLight } from "./downloadsAudio";
import { isCapabilityDeclared } from "../serverCapabilities/declaredCapabilities";


/** Identifiant d'appareil qu'un client peut choisir pour sa session de transcodage. */
const DEVICE_ID_RE = /^tentacle-dl-[0-9a-fA-F]{8}$/;

/**
 * Session de transcodage choisie par le CLIENT, si elle a la bonne forme.
 *
 * Sur mobile, le téléchargeur natif ne livre les en-têtes de réponse qu'à la
 * fin du transfert : une pause ou une annulation ne pourrait pas arrêter la
 * conversion côté Jellyfin. Le téléphone choisit donc ses identifiants et les
 * transmet ; un client qui n'en envoie pas (le bureau) reçoit ceux du serveur
 * dans les en-têtes, comme avant.
 */
function clientSession(query: Record<string, string | undefined>): { playSessionId: string; deviceId: string } | null {
  const playSessionId = query.playSessionId ?? "";
  const deviceId = query.deviceId ?? "";
  if (!ITEM_ID_RE.test(playSessionId) || !DEVICE_ID_RE.test(deviceId)) return null;
  return { playSessionId, deviceId };
}

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

/**
 * Les deux routes de flux relaient des octets TELS QUELS. `@fastify/compress`
 * est enregistré pour tout le serveur et compresse `application/octet-stream`
 * par défaut : un Original servi sous ce type à un client qui annonce `gzip`
 * perdrait son `content-length` et son Range — et un tampon zlib entre le
 * limiteur de débit et la socket n'aurait aucun sens.
 */
const RAW_STREAM = { config: { compress: false } } as const;

function notFound(reply: FastifyReply) {
  return reply.status(404).send({ error: "Not found" });
}

export const downloadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  /** Capacités de l'utilisateur courant. Sans droit → tout à false,
   *  indiscernable d'une fonctionnalité désactivée côté serveur. */
  app.get("/capabilities", async (request) => {
    const token = getTokenFromRequest(request);
    if (!token) {
      return {
        downloads: false,
        remuxDownloads: false,
        lightDownloads: false,
        audioConversion: false,
        lightPresets: [],
      };
    }
    const capabilities = await getDownloadCapabilities(token);
    // Les paliers servis : un client ancien ignore le champ, un client récent
    // n'y propose « qualité d'origine » que si `pmax` y figure. Les deux
    // familles sont désormais indépendantes — `pmax` seul est un cas normal.
    return { ...capabilities, lightPresets: presetsFor(capabilities) };
  });

  /** Fichier original — pipe de `GET /Items/{id}/Download` (Range passthrough). */
  app.get("/original/:itemId", RAW_STREAM, async (request, reply) => {
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
      upstream = await fetch(`${jellyfinUrl}/Items/${encodeURIComponent(itemId)}/Download`, { headers });
    } catch {
      return notFound(reply);
    }
    if ((upstream.status !== 200 && upstream.status !== 206) || !upstream.body) {
      return notFound(reply);
    }

    reply.status(upstream.status);
    // Un nginx devant ne doit pas absorber le débit à notre place : sous
    // plafond, la contre-pression doit traverser jusqu'au client.
    reply.header("x-accel-buffering", "no");
    for (const name of RELAYED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) reply.header(name, value);
    }
    return reply.send(
      throttled(request, Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream)),
    );
  });

  /** Mode Allégé — flux transcodé progressif fMP4 (`stream.mp4?static=false`,
   *  fragmenté par Jellyfin : `frag_keyframe+empty_moov`, fichier valide une
   *  fois complet — vérifié source v10.11.11), pour TOUS les paliers, `pmax`
   *  compris : voir l'avertissement sur `context=Static` (`lightStream.ts`). Pas de
   *  Range possible sur un transcode : toute reprise repart de zéro (géré côté
   *  moteur desktop).
   *  Le droit appliqué ICI dépend du palier : `pmax` recopie l'image, il ne
   *  demande que les droits de transcodage de lecture ; les trois autres
   *  recompressent et exigent en plus `EnableMediaConversion` (que Jellyfin
   *  n'enforce pas lui-même). */
  app.get("/light/:itemId", RAW_STREAM, async (request, reply) => {
    const token = getTokenFromRequest(request);
    const { itemId } = request.params as { itemId: string };
    const query = request.query as Record<string, string | undefined>;
    // Un titre de musique gardé (capacité `offline.music`) : l'Allégé AUDIO — seulement sur un serveur
    // qui la déclare ; sinon, la demande audio n'existe pas (404, comme toute demande inconnue).
    const audio = token ? parseAudioLightRequest(itemId, query) : null;
    if (audio && !isCapabilityDeclared("offline.music")) return notFound(reply);
    if (token && audio) return serveAudioLight(request, reply, token, audio);
    const light = token ? parseLightRequest(itemId, query) : null;
    if (!token || !light) return notFound(reply);
    // La garde suit le palier : `pmax` recopie l'image et n'exige donc que le
    // transcodage de lecture ; les paliers qui recompressent gardent
    // `EnableMediaConversion`.
    const allowed =
      light.presetId === REMUX_PRESET_ID
        ? await checkRemuxRight(token, itemId)
        : await checkLightRight(token, itemId);
    if (!allowed) return notFound(reply);

    const jellyfinUrl = getJellyfinUrl();
    if (!jellyfinUrl) return notFound(reply);

    // Session de transcodage dédiée — celle du client s'il en a choisi une,
    // sinon la nôtre — renvoyée dans les en-têtes pour l'arrêt propre
    // (DELETE Videos/ActiveEncodings via le proxy) à toute fin de transfert.
    const client = clientSession(query);
    const playSessionId = client?.playSessionId ?? randomUUID();
    const deviceId = client?.deviceId ?? `tentacle-dl-${playSessionId.slice(0, 8)}`;
    const params = lightStreamParams(light, { playSessionId, deviceId });

    let upstream: Response;
    try {
      upstream = await fetch(`${jellyfinUrl}/Videos/${encodeURIComponent(light.itemId)}/stream.mp4?${params.toString()}`, {
        headers: { Authorization: mediaBrowserAuthHeader(token) },
      });
    } catch {
      return notFound(reply);
    }
    if (upstream.status !== 200 || !upstream.body) return notFound(reply);

    reply.status(200);
    reply.header("x-accel-buffering", "no");
    reply.header("content-type", upstream.headers.get("content-type") ?? "video/mp4");
    reply.header("x-tentacle-play-session", playSessionId);
    reply.header("x-tentacle-device-id", deviceId);
    return reply.send(
      throttled(request, Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream)),
    );
  });
};
