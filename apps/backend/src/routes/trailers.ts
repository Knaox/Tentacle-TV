/* ------------------------------------------------------------------ */
/*  Bandes-annonces YouTube → flux que l'Apple TV lit sans faute        */
/*                                                                     */
/*  Apple TV n'a pas de WebView : impossible d'embarquer le lecteur    */
/*  YouTube comme sur Android. Le serveur extrait le flux (yt-dlp) et  */
/*  le RELAIE (routes/trailerMedia.ts) : le téléviseur ne parle qu'à   */
/*  son serveur, quelle que soit son adresse IP — les URL googlevideo, */
/*  elles, sont liées à celle de l'extraction. Résolution gardée en    */
/*  mémoire jusqu'à l'échéance des URL, préparable dès l'ouverture de  */
/*  la fiche. Aucune clé exposée, routes protégées par requireAuth.    */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../middleware/auth";
import { startYtDlpUpdates } from "../services/ytDlp";
import { prepareTrailer, resolveTrailer } from "../services/trailers/trailerRelay";
import { signRelayToken } from "../services/trailers/relayToken";

/** Même contrainte que parseYouTubeId (@tentacle-tv/shared) : 11 caractères. */
const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const HLS_MIME = "application/vnd.apple.mpegurl";

function ytIdOf(request: FastifyRequest): string | null {
  const { ytId } = request.query as { ytId?: string };
  return ytId && YT_ID_RE.test(ytId) ? ytId : null;
}

export async function trailerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  // yt-dlp suit YouTube : la copie à jour remplace l'épinglé de l'image (cf. services/ytDlp).
  startYtDlpUpdates();

  /**
   * GET /api/trailers/resolve?ytId=<11 chars>
   * → 200 { url, path, mimeType, expiresAt }  le flux RELAYÉ par ce serveur :
   *        `path` à poser derrière l'adresse que le client connaît (la TV) ;
   *        `url`, la même en absolu, pour les versions qui l'attendent
   *        (adresse vue par la requête — `trustProxy` honore X-Forwarded-*)
   * → 400 { error: "invalid ytId" }
   * → 404 { error: "unavailable" }  aucun flux lisible (retenu une minute,
   *        une heure si la vidéo est retirée ou privée)
   */
  app.get("/resolve", async (request: FastifyRequest, reply: FastifyReply) => {
    const ytId = ytIdOf(request);
    if (!ytId) return reply.status(400).send({ error: "invalid ytId" });

    const resolved = await resolveTrailer(ytId);
    if (!resolved) return reply.status(404).send({ error: "unavailable" });

    const token = signRelayToken(ytId);
    const path = resolved.kind === "hls"
      ? `/api/trailers/hls/${ytId}/master.m3u8?t=${token}`
      : `/api/trailers/file/${ytId}.mp4?t=${token}`;
    return {
      url: `${request.protocol}://${request.host}${path}`,
      path,
      mimeType: resolved.kind === "hls" ? HLS_MIME : "video/mp4",
      expiresAt: resolved.validUntil,
    };
  });

  /**
   * GET /api/trailers/prepare?ytId=<11 chars> → 202, tout de suite.
   * La fiche qui propose une bande-annonce la fait préparer — extraction,
   * maître, premières listes — pendant qu'on la lit : le lancement n'attend
   * plus yt-dlp. Sans effet si elle est déjà prête ou en cours.
   */
  app.get("/prepare", async (request: FastifyRequest, reply: FastifyReply) => {
    const ytId = ytIdOf(request);
    if (!ytId) return reply.status(400).send({ error: "invalid ytId" });
    void prepareTrailer(ytId).catch((err) => console.warn(`[trailers] préparation de ${ytId} :`, err?.message ?? err));
    return reply.status(202).send({ status: "preparing" });
  });
}
