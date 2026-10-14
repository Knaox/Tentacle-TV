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
/*                                                                     */
/*  Le même relais lit Dailymotion (`dmId`, les bandes-annonces        */
/*  d'AlloCiné) : son flux SANS publicité, relayé de la même façon —   */
/*  ses URL sont, elles aussi, liées à l'adresse qui les a obtenues.   */
/*  Le web et le bureau y lisent leur lecteur complet.                 */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { startYtDlpUpdates } from "../services/ytDlp";
import { resolveTrailer } from "../services/trailers/trailerRelay";
import { holdsSource, prepareTrailer } from "../services/trailers/trailerPrepare";
import { takeYouTubePlayback, youtubeBreakerOpen } from "../services/trailers/youtubeGuard";
import type { JellyfinUser } from "../middleware/auth";
import { relayedStream } from "../services/trailers/relayPaths";
import { orderSubtitles } from "../services/trailers/trailerSubtitles";
import { isDailymotionId, isYouTubeId, refOfQuery, refPathSegment, type VideoRef } from "../services/trailers/videoRef";
import { refreshTitleLanguage } from "../services/reco/titleLanguage";

/** L'issue d'une lecture, telle que le lecteur la rend (`reportTrailerOutcome`) : `ytId` OU `dmId`. */
const OUTCOME = z.object({
  ytId: z.string().refine(isYouTubeId).optional(),
  dmId: z.string().refine(isDailymotionId).optional(),
  ok: z.boolean(),
  ms: z.number().int().min(0).max(10 * 60_000),
  reason: z.string().max(200).optional(),
}).refine((o) => (o.ytId === undefined) !== (o.dmId === undefined));

function refOf(request: FastifyRequest): VideoRef | null {
  return refOfQuery(request.query as { ytId?: unknown; dmId?: unknown });
}

const LANG_RE = /^[a-zA-Z]{2,3}(-[\w]{2,8})?$/;

/** Le compte de la requête (`requireAuth`), pour le seau de lectures YouTube. */
function accountOf(request: FastifyRequest): string {
  return (request as FastifyRequest & { user?: JellyfinUser }).user?.userId ?? "anonyme";
}

/**
 * Une vidéo YouTube que le relais ne tient pas encore coûte une extraction :
 * elle passe par le garde des LECTURES (`takeYouTubePlayback` — budget du
 * serveur, seau du compte, disjoncteur et sa lecture-sonde). Refusée, le
 * client ouvre le lecteur officiel (`409 { fallback: "embed" }`). Dailymotion
 * et une vidéo déjà tenue ne demandent rien.
 */
function playbackRefusal(ref: VideoRef, request: FastifyRequest) {
  if (ref.kind !== "youtube" || holdsSource(ref.key)) return null;
  return takeYouTubePlayback(accountOf(request));
}

/**
 * La langue des sous-titres en tête : celle que le client demande (la TV
 * passe son interface), sinon celle du SERVEUR — la langue des métadonnées
 * de Jellyfin, celle des titres hors bibliothèque (`titleLanguage.ts`).
 */
async function subtitleLanguage(request: FastifyRequest): Promise<string | undefined> {
  const { lang } = request.query as { lang?: string };
  if (typeof lang === "string" && LANG_RE.test(lang)) return lang;
  return (await refreshTitleLanguage().catch(() => null)) ?? undefined;
}

export async function trailerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  // yt-dlp suit YouTube : la copie à jour remplace l'épinglé de l'image (cf. services/ytDlp).
  startYtDlpUpdates();

  /**
   * GET /api/trailers/resolve?ytId=<11 chars>|dmId=<id>[&lang=fr]
   * → 200 { url, path, mimeType, expiresAt, qualities, subtitles }  le flux
   *        RELAYÉ par ce serveur :
   *        `path` à poser derrière l'adresse que le client connaît (la TV) ;
   *        `url`, la même en absolu, pour les versions qui l'attendent
   *        (adresse vue par la requête — `trustProxy` honore X-Forwarded-*) ;
   *        `qualities` [{ height, path }] : un maître réduit à chaque hauteur
   *        (`path` seul vaut « Auto ») — vide pour un MP4 ;
   *        `subtitles` [{ lang, label, auto, path }] : les pistes de YouTube,
   *        relayées en WebVTT, la langue `lang` (l'interface) puis l'anglais
   *        en tête — sans `lang`, la langue du serveur (métadonnées de
   *        Jellyfin), rendue dans `language`. Additifs (capacité
   *        `trailers.player`) : un client d'avant ne lit que `url` / `path`.
   * → 400 { error: "invalid ytId" }
   * → 409 { fallback: "embed", reason }  YouTube ne peut pas être extrait
   *        maintenant (pause du disjoncteur, budget de l'heure, seau du
   *        compte) : le lecteur officiel, en repli (capacité `trailers.catalog`)
   * → 404 { error: "unavailable" }  aucun flux lisible (retenu une minute,
   *        une heure si la vidéo est retirée ou privée)
   */
  app.get("/resolve", async (request: FastifyRequest, reply: FastifyReply) => {
    const ref = refOf(request);
    if (!ref) return reply.status(400).send({ error: "invalid ytId" });
    const refusal = playbackRefusal(ref, request);
    if (refusal) {
      console.warn(`[trailers] ${ref.key} : lecteur officiel en repli (${refusal.kind})`);
      return reply.status(409).send({ fallback: "embed", reason: refusal.kind });
    }

    const [resolved, language] = await Promise.all([resolveTrailer(ref.key), subtitleLanguage(request)]);
    if (!resolved) return reply.status(404).send({ error: "unavailable" });
    // Le maître et les premières listes partent chez googlevideo pendant que la
    // réponse voyage : AVPlayer les trouvera prêts, ou en route.
    void prepareTrailer(ref.key).catch(() => undefined);

    const { token, path, mimeType, qualities } = relayedStream(ref.key, resolved);
    return {
      url: `${request.protocol}://${request.host}${path}`,
      path,
      mimeType,
      expiresAt: resolved.validUntil,
      qualities,
      subtitles: orderSubtitles(resolved.subtitles, language).map((s) => ({
        lang: s.lang, label: s.label, auto: s.auto, path: `/api/trailers/subs/${refPathSegment(ref.key)}/${s.key}.vtt?t=${token}`,
      })),
      ...(language ? { language } : {}),
    };
  });

  /**
   * GET /api/trailers/prepare?ytId=<11 chars>|dmId=<id> → 202, tout de suite.
   * La fiche qui propose une bande-annonce la fait préparer — extraction,
   * maître, premières listes — pendant qu'on la lit : le lancement n'attend
   * plus yt-dlp. Sans effet si elle est déjà prête ou en cours.
   */
  app.get("/prepare", async (request: FastifyRequest, reply: FastifyReply) => {
    const ref = refOf(request);
    if (!ref) return reply.status(400).send({ error: "invalid ytId" });
    // Jamais pendant une pause de YouTube, et une préparation compte comme la lecture qu'elle annonce.
    if (ref.kind === "youtube" && !holdsSource(ref.key) && (youtubeBreakerOpen() || takeYouTubePlayback(accountOf(request)))) {
      return reply.status(202).send({ status: "skipped" });
    }
    void prepareTrailer(ref.key).catch((err) => console.warn(`[trailers] préparation de ${ref.key} :`, err?.message ?? err));
    return reply.status(202).send({ status: "preparing" });
  });

  /**
   * POST /api/trailers/report { ytId | dmId, ok, ms, reason? } → 204.
   * Le téléviseur dit comment la lecture s'est passée : la première image et
   * son délai depuis l'ouverture de l'écran, ou l'échec et sa raison. Une
   * ligne de journal par lecture — c'est elle qui dira, en production, que
   * YouTube a de nouveau changé (docs/BANDES-ANNONCES.md, « Surveiller »).
   */
  app.post("/report", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = OUTCOME.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid report" });
    const { ok, ms, reason } = parsed.data;
    const video = parsed.data.ytId ?? `dm:${parsed.data.dmId}`;
    if (ok) console.log(`[trailers] ${video} : première image en ${ms} ms`);
    else console.warn(`[trailers] ${video} : échec de lecture après ${ms} ms (${reason ?? "sans raison"})`);
    return reply.status(204).send();
  });
}
