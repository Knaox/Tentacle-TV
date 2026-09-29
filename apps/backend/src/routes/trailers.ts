/* ------------------------------------------------------------------ */
/*  Résolution de bandes-annonces YouTube → flux MP4 jouable          */
/*                                                                     */
/*  Apple TV n'a pas de WebView : impossible d'embarquer le lecteur    */
/*  YouTube comme sur Android. On résout donc l'ID YouTube en une URL  */
/*  de flux MP4 progressif (muxé audio+vidéo) via yt-dlp, lue ensuite  */
/*  par react-native-video côté tvOS. Côté serveur uniquement —        */
/*  aucune clé exposée, endpoint protégé par requireAuth (Bearer).     */
/* ------------------------------------------------------------------ */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { execFile } from "child_process";
import { requireAuth } from "../middleware/auth";
import { startYtDlpUpdates, ytDlpCommand } from "../services/ytDlp";

/** Même contrainte que parseYouTubeId (@tentacle-tv/shared) : 11 caractères. */
const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

interface ResolvedStream {
  url: string;
  /** "application/vnd.apple.mpegurl" (HLS) ou "video/mp4" (progressif). */
  mimeType: string;
  /** Epoch ms d'expiration de l'URL signée googlevideo. */
  expiresAt: number;
}

/** Détecte un flux HLS (manifest m3u8) — joué nativement par AVPlayer (tvOS). */
function isHlsUrl(url: string): boolean {
  return url.includes(".m3u8") || url.includes("/manifest/hls");
}

/**
 * Cache mémoire ytId → flux résolu. Les URLs googlevideo sont signées et
 * expirent (~6 h, paramètre `expire`). On respecte ce TTL pour ne pas servir
 * une URL morte. Le nombre de trailers distincts reste faible → pas de prune
 * agressif nécessaire (même approche que le cache Map de tmdb.ts).
 */
const cache = new Map<string, ResolvedStream>();

/**
 * Lit l'expiration réelle de l'URL signée ; repli 5 h si absente.
 * Gère les deux formes googlevideo : query `?expire=123` (progressif) et
 * chemin `/expire/123/` (manifest HLS).
 */
function parseExpiry(url: string): number {
  const m = url.match(/[?&/]expire[=/](\d+)/);
  if (m) return Number(m[1]) * 1000;
  return Date.now() + 5 * 60 * 60 * 1000;
}

/**
 * Interface d'extraction volontairement isolée : si yt-dlp devient ingérable,
 * on peut swapper l'implémentation (ex. lib JS) sans toucher la route.
 *
 * Format demandé : on sélectionne le meilleur flux MUXÉ (audio+vidéo dans un
 * seul manifest) jusqu'à 1080p, indépendamment de l'itag. C'est volontairement
 * agnostique : YouTube sert le HLS muxé via des itags variables selon le fps
 * (91-96 en 24/30 fps → 96=1080p ; 300=720p60 / 301=1080p60 en 60 fps). Une
 * liste figée (ex. ancien `96/95/94`) ratait les flux 60 fps et retombait à
 * 480p/360p. Repli sur le meilleur muxé restant (MP4 progressif 18=360p si
 * c'est tout ce qui reste). Tous lus nativement par AVPlayer/tvOS, aucun remux
 * ffmpeg requis (la 4K n'existe qu'en DASH séparé → hors scope).
 *
 * Le HLS est demandé EN PREMIER : à résolution voisine, yt-dlp classe le MP4
 * progressif au-dessus (protocole https), et l'itag 18 qu'il rend est refusé
 * en 403 à la lecture (mesuré le 2026-09-29) — « Lecture YouTube
 * indisponible » sur l'Apple TV.
 */
const FORMAT =
  "best[protocol*=m3u8][acodec!=none][vcodec!=none][height<=1080]" +
  "/best[acodec!=none][vcodec!=none][height<=1080]/best[acodec!=none][vcodec!=none]";

/**
 * Les défis JavaScript de YouTube (« EJS ») : sans les résoudre, YouTube ne
 * donne plus de HLS muxé, seulement l'itag 18 ou des flux séparés. Il faut à
 * yt-dlp un moteur JS (deno, son défaut) et le solveur, qu'on l'autorise à
 * tirer de GitHub. Mesuré le 2026-09-29 : yt-dlp 2026.06 + deno rend un HLS
 * lisible à une extraction sur trois environ ; sans moteur, ou avec le yt-dlp
 * 2026.03 d'Alpine, jamais. `--js-runtimes node` n'aide pas (node 20 refusé,
 * node 26 retenu mais sans HLS). Un yt-dlp trop ancien pour cette option
 * (sortie 2, erreur d'usage) est relancé sans elle, une fois pour toutes.
 */
const EJS_ARGS = ["--remote-components", "ejs:github"];
let ejsSupported = true;

/**
 * Le client « web_safari » d'abord : c'est à Safari que YouTube sert le HLS
 * muxé (5 formats contre 1 pour les clients par défaut, mesuré dans l'image),
 * celui qu'AVPlayer lit tel quel ; les clients par défaut restent en repli.
 */
const CLIENT_ARGS = ["--extractor-args", "youtube:player_client=web_safari,default"];

function resolveOnce(ytId: string): Promise<ResolvedStream | null> {
  const withEjs = ejsSupported;
  return new Promise((resolve) => {
    execFile(
      ytDlpCommand(),
      [
        ...(withEjs ? EJS_ARGS : []),
        ...CLIENT_ARGS,
        "-f", FORMAT,
        "-g", // imprime l'URL directe du flux/manifest
        "--no-warnings",
        "--no-playlist",
        `https://www.youtube.com/watch?v=${ytId}`,
      ],
      // 20 s : l'extraction HLS moderne (téléchargement du player JS + résolution
      // PO token + manifest m3u8) est plus lourde que l'ancien chemin progressif.
      { timeout: 20_000, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (err && withEjs && (err as { code?: unknown }).code === 2) {
          ejsSupported = false;
          return resolve(resolveOnce(ytId));
        }
        if (err) return resolve(null);
        const url = (stdout || "").trim().split("\n")[0];
        if (!url || !url.startsWith("http")) return resolve(null);
        const mimeType = isHlsUrl(url) ? "application/vnd.apple.mpegurl" : "video/mp4";
        resolve({ url, mimeType, expiresAt: parseExpiry(url) });
      },
    );
  });
}

/**
 * Le flux progressif se laisse-t-il lire ? Les premiers octets suffisent : un
 * itag 18 obtenu sans résoudre les défis YouTube répond 403 — le rendre au
 * téléviseur, c'était lui faire afficher « indisponible » après coup.
 */
async function isReadable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(5_000) });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

/** Mesuré le 2026-09-29 : le HLS muxé n'est offert qu'à 2 extractions sur 5. */
const MAX_ATTEMPTS = 5;

/**
 * Une vidéo introuvable n'est pas redemandée avant 10 min. Chaque échec coûte
 * cinq extractions, et YouTube bride l'adresse qui en enchaîne trop — plus
 * aucun flux pour personne (vécu le 2026-09-29, après une centaine d'essais).
 */
const MISS_TTL_MS = 10 * 60 * 1000;
const misses = new Map<string, number>();

/**
 * Résout en privilégiant le HLS muxé HD (jusqu'à 1080p). YouTube force par
 * intermittence le « SABR streaming » : quand l'extraction dégrade, yt-dlp ne
 * renvoie plus que le MP4 progressif 360p (itag 18). On retente donc tant
 * qu'on n'obtient qu'un flux progressif (`video/mp4`) ; la tentative dégradée
 * revient vite (pas de téléchargement m3u8), le coût du retry est faible. Le
 * meilleur progressif obtenu reste l'ultime repli — mieux vaut 360p que rien
 * si la vidéo n'a réellement aucun HLS —, mais seulement s'il se laisse lire.
 */
async function resolveYtStream(ytId: string): Promise<ResolvedStream | null> {
  let fallback: ResolvedStream | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const r = await resolveOnce(ytId);
    if (!r) continue;
    if (r.mimeType === "application/vnd.apple.mpegurl") return r; // HLS HD → on prend
    fallback = r; // progressif 360p : extraction dégradée probable → on retente
  }
  return fallback && (await isReadable(fallback.url)) ? fallback : null;
}

export async function trailerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  // yt-dlp suit YouTube : la copie à jour remplace l'épinglé de l'image (cf. services/ytDlp).
  startYtDlpUpdates();

  /**
   * GET /api/trailers/resolve?ytId=<11 chars>
   * → 200 { url, mimeType, expiresAt }   flux HLS (ou MP4 lisible) jouable
   * → 400 { error: "invalid ytId" }
   * → 404 { error: "unavailable" }       aucun flux muxé jouable / extraction KO
   *                                       (retenu 10 min, cf. MISS_TTL_MS)
   */
  app.get("/resolve", async (request: FastifyRequest, reply: FastifyReply) => {
    const { ytId } = request.query as { ytId?: string };
    if (!ytId || !YT_ID_RE.test(ytId)) {
      return reply.status(400).send({ error: "invalid ytId" });
    }

    const cached = cache.get(ytId);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached;
    }
    if ((misses.get(ytId) ?? 0) > Date.now()) {
      return reply.status(404).send({ error: "unavailable" });
    }

    const resolved = await resolveYtStream(ytId);
    if (!resolved) {
      cache.delete(ytId);
      if (misses.size > 500) for (const [id, until] of misses) if (until <= Date.now()) misses.delete(id);
      misses.set(ytId, Date.now() + MISS_TTL_MS);
      return reply.status(404).send({ error: "unavailable" });
    }
    misses.delete(ytId);
    // On ne met en cache (longue durée) que le HLS HD. Un repli progressif 360p
    // (extraction dégradée par le SABR YouTube) n'est PAS caché : sinon une
    // dégradation passagère figerait la 360p pendant des heures. La requête
    // suivante retentera et obtiendra quasi sûrement le HLS HD.
    if (resolved.mimeType === "application/vnd.apple.mpegurl") {
      cache.set(ytId, resolved);
    } else {
      cache.delete(ytId);
    }
    return resolved;
  });
}
