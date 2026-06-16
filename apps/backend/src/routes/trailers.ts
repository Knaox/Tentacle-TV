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
 * Format demandé : on PRIVILÉGIE le HLS muxé haute résolution (formats YouTube
 * 96=1080p, 95=720p, 94=480p), idéal pour AVPlayer/tvOS et toujours muxé
 * (audio+vidéo dans un seul manifest). Repli sur le MP4 progressif muxé
 * (22=720p, 18=360p, souvent seul 18 restant). Aucun remux ffmpeg requis.
 */
function resolveYtStream(ytId: string): Promise<ResolvedStream | null> {
  return new Promise((resolve) => {
    execFile(
      "yt-dlp",
      [
        "-f", "96/95/94/22/18/best[ext=mp4][acodec!=none][vcodec!=none]",
        "-g", // imprime l'URL directe du flux/manifest
        "--no-warnings",
        "--no-playlist",
        `https://www.youtube.com/watch?v=${ytId}`,
      ],
      { timeout: 12_000, maxBuffer: 1024 * 1024 },
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
    cache.set(ytId, resolved);
    return resolved;
  });
}
