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

const ITEM_ID_RE = /^[0-9a-fA-F-]{32,36}$/;

interface TranscodePreset {
  /** Listes acceptées par Jellyfin : le premier codec est la cible d'un réencodage, toute la liste autorise la copie. */
  videoCodec: string;
  audioCodec: string;
  videoBitRate?: number;
  audioBitRate?: number;
  maxHeight?: number;
  /** Plafond de canaux — un MAXIMUM : une source stéréo n'est pas gonflée. */
  maxAudioChannels?: number;
}

/**
 * Paliers du mode Allégé — les trois premiers sont le miroir de
 * `packages/offline-core/src/core/presets.ts`.
 *
 * `pmax` = QUALITÉ D'ORIGINE EN MP4, pour les appareils qui ne lisent pas le
 * MKV (iPhone, iPad) : aucun plafond de débit — Jellyfin REFUSE la copie de
 * flux dès qu'un `videoBitRate` est demandé et que le débit de la source est
 * inconnu, ce qui est fréquent en MKV —, donc la vidéo H.264/HEVC est recopiée
 * telle quelle (10 bits et HDR compris).
 *
 * ⚠️ JAMAIS `context=Static` ici. Il demande un MP4 classique, dont l'index
 * (`moov`) s'écrit EN DERNIER — or Jellyfin sert le fichier pendant que ffmpeg
 * l'écrit encore. Dès que le client va plus vite que le transcodage, la réponse
 * s'achève sur la fin du `mdat` et l'index n'arrive jamais : fichier ni lisible
 * ni finalisable (mesuré sur deux épisodes de Rick et Morty — HEVC copié, mais
 * audio E-AC3 à réencoder, donc un transcodage assez lent pour se faire
 * doubler ; Naruto, lui, en pure copie, passait). Le fMP4 fragmenté que rend
 * Jellyfin par défaut se décrit dès son premier octet ; la finalisation native
 * du client en fait ensuite un MP4 indexé, ce qui est précisément son travail.
 *
 * L'audio, lui, passe TOUJOURS en AAC sur ce palier : voir le commentaire de
 * `pmax` ci-dessous, cette copie-là écrivait des fichiers illisibles.
 */
const TRANSCODE_PRESETS: Record<string, TranscodePreset> = {
  p1080: { videoCodec: "h264", audioCodec: "aac", videoBitRate: 8_000_000, audioBitRate: 192_000, maxHeight: 1080 },
  p720: { videoCodec: "h264", audioCodec: "aac", videoBitRate: 4_000_000, audioBitRate: 160_000, maxHeight: 720 },
  p480: { videoCodec: "h264", audioCodec: "aac", videoBitRate: 1_500_000, audioBitRate: 128_000, maxHeight: 480 },
  // Le remux garde l'IMAGE telle quelle, mais jamais le Dolby Digital : en
  // copiant de l'ac3/eac3 vers un MP4, Jellyfin écrit un fichier sans `moov`
  // (mesuré — `ftyp`, `free`, puis un `mdat` de taille nulle). Ni lisible, ni
  // finalisable : deux épisodes entièrement reçus étaient bons à jeter. L'audio
  // repasse donc en AAC, et le plafond de canaux lui évite de redescendre en
  // stéréo au passage — puisqu'il ne peut plus être copié, qu'il perde au
  // moins le minimum.
  pmax: { videoCodec: "h264,hevc", audioCodec: "aac", maxAudioChannels: 6 },
};

/** Le palier qui recopie l'image ; il ne dépend PAS du droit de conversion. */
const REMUX_PRESET_ID = "pmax";
/** Ce que ces droits-là donnent droit à demander. L'ordre reste celui de
 *  `TRANSCODE_PRESETS` : un client ancien lit la liste telle qu'il l'attendait. */
function presetsFor(capabilities: { remuxDownloads: boolean; lightDownloads: boolean }): string[] {
  return Object.keys(TRANSCODE_PRESETS).filter((id) =>
    id === REMUX_PRESET_ID ? capabilities.remuxDownloads : capabilities.lightDownloads,
  );
}

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
   *  fois complet — vérifié source v10.11.11), pour TOUS les paliers, `pmax`
   *  compris : voir l'avertissement sur `context=Static` plus haut. Pas de
   *  Range possible sur un transcode : toute reprise repart de zéro (géré côté
   *  moteur desktop).
   *  Le droit appliqué ICI dépend du palier : `pmax` recopie l'image, il ne
   *  demande que les droits de transcodage de lecture ; les trois autres
   *  recompressent et exigent en plus `EnableMediaConversion` (que Jellyfin
   *  n'enforce pas lui-même). */
  app.get("/light/:itemId", async (request, reply) => {
    const token = getTokenFromRequest(request);
    const { itemId } = request.params as { itemId: string };
    const query = request.query as Record<string, string | undefined>;
    const presetId = query.preset ?? "p720";
    const preset = TRANSCODE_PRESETS[presetId];
    if (!token || !ITEM_ID_RE.test(itemId) || !preset) return notFound(reply);
    // La garde suit le palier : `pmax` recopie l'image et n'exige donc que le
    // transcodage de lecture ; les paliers qui recompressent gardent
    // `EnableMediaConversion`.
    const allowed =
      presetId === REMUX_PRESET_ID
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
    const params = new URLSearchParams({
      static: "false",
      container: "mp4",
      videoCodec: preset.videoCodec,
      audioCodec: preset.audioCodec,
      deviceId,
      playSessionId,
      // Copie de flux autorisée sous le plafond de débit : une source déjà
      // h264/aac plus légère que le preset est remuxée sans réencodage.
      allowVideoStreamCopy: "true",
      allowAudioStreamCopy: "true",
    });
    if (preset.videoBitRate !== undefined) params.set("videoBitRate", String(preset.videoBitRate));
    if (preset.audioBitRate !== undefined) params.set("audioBitRate", String(preset.audioBitRate));
    if (preset.maxHeight !== undefined) params.set("maxHeight", String(preset.maxHeight));
    if (preset.maxAudioChannels !== undefined) {
      params.set("maxAudioChannels", String(preset.maxAudioChannels));
    }
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
