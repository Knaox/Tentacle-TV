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
 */
function resolveOnce(ytId: string): Promise<ResolvedStream | null> {
  return new Promise((resolve) => {
    execFile(
      "yt-dlp",
      [
        "-f", "best[acodec!=none][vcodec!=none][height<=1080]/best[acodec!=none][vcodec!=none]",
        "-g", // imprime l'URL directe du flux/manifest
        "--no-warnings",
        "--no-playlist",
        `https://www.youtube.com/watch?v=${ytId}`,
      ],
      // 20 s : l'extraction HLS moderne (téléchargement du player JS + résolution
      // PO token + manifest m3u8) est plus lourde que l'ancien chemin progressif.
      { timeout: 20_000, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
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
 * Résout en privilégiant le HLS muxé HD (jusqu'à 1080p). YouTube force par
 * intermittence le « SABR streaming » : quand l'extraction dégrade, yt-dlp ne
 * renvoie plus que le MP4 progressif 360p (itag 18). Comme l'extraction HLS
 * réussit quasi systématiquement à l'essai suivant, on retente jusqu'à 3 fois
 * tant qu'on n'obtient qu'un flux progressif (`video/mp4`). La tentative
 * dégradée revient vite (pas de téléchargement m3u8) → le coût du retry est
 * faible. On conserve le meilleur progressif obtenu comme ultime repli (mieux
 * vaut 360p que rien si la vidéo n'a réellement aucun HLS).
 */
async function resolveYtStream(ytId: string): Promise<ResolvedStream | null> {
  let fallback: ResolvedStream | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await resolveOnce(ytId);
    if (!r) continue;
    if (r.mimeType === "application/vnd.apple.mpegurl") return r; // HLS HD → on prend
    fallback = r; // progressif 360p : extraction dégradée probable → on retente
  }
  return fallback;
}

export async function trailerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  /**
   * GET /api/trailers/resolve?ytId=<11 chars>
   * → 200 { url, mimeType, expiresAt }   flux MP4 jouable
   * → 400 { error: "invalid ytId" }
   * → 404 { error: "unavailable" }       aucun flux muxé jouable / extraction KO
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

    const resolved = await resolveYtStream(ytId);
    if (!resolved) {
      cache.delete(ytId);
      return reply.status(404).send({ error: "unavailable" });
    }
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
