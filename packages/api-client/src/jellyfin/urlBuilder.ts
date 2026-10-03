import { TRANSCODE_TIERS, bestTierForBudget, transcodeTarget, type MediaSource, type TranscodeTarget } from "@tentacle-tv/shared";
import { buildQuery } from "./types";
import { imageBudget } from "../net/dataSaver";
import { pixelDensity } from "../net/pixelDensity";

/** Callback that rewrites a same-origin proxy URL to the direct-streaming URL
 *  when direct streaming is active, otherwise returns the proxy URL unchanged. */
export type ResolveMediaUrl = (proxyUrl: string) => string;

export type ImageType = "Primary" | "Backdrop" | "Logo" | "Thumb";

export interface ImageUrlOptions {
  width?: number;
  height?: number;
  quality?: number;
  tag?: string;
  index?: number;
}

/**
 * Point d'accroche UNIQUE des ~60 appelants d'images : c'est ici, et nulle part
 * ailleurs, que s'applique le budget du mode économie. Les images pèsent ~75 %
 * du fil et sont incompressibles (`image/jpeg` n'est pas compressible au sens
 * de mime-db, donc @fastify/compress ne les touche pas) — c'est le principal
 * gisement d'économie de l'app.
 *
 * En mode normal le budget est neutre (scale 1, plafond 100 > toutes les
 * qualités demandées) : les URLs produites sont identiques à l'existant.
 */
export function buildImageUrl(
  baseUrl: string,
  itemId: string,
  imageType: ImageType,
  options: ImageUrlOptions | undefined,
  resolveMediaUrl: ResolveMediaUrl,
): string {
  const { scale, maxQuality } = imageBudget();
  // Les appelants demandent une taille CSS ; la densité la ramène à la
  // résolution où l'image sera réellement rastérisée. Neutre partout sauf sur
  // le téléviseur, qui compose à 1280 pour une dalle de 1920.
  const density = scale * pixelDensity();
  const p: Record<string, string> = {};
  if (options?.width) p.maxWidth = String(Math.round(options.width * density));
  if (options?.height) p.maxHeight = String(Math.round(options.height * density));
  if (options?.quality) p.quality = String(Math.min(options.quality, maxQuality));
  if (options?.tag) p.tag = options.tag;
  const idx = options?.index ?? 0;
  const suffix = imageType === "Backdrop" && idx > 0 ? `/${idx}` : "";
  const url = `${baseUrl}/Items/${itemId}/Images/${imageType}${suffix}?${buildQuery(p)}`;
  return resolveMediaUrl(url);
}

export interface StreamUrlOptions {
  audioIndex?: number;
  mediaSourceId?: string;
  maxBitrate?: number;
  maxHeight?: number;
  directPlay?: boolean;
  startTimeTicks?: number;
  playSessionId?: string;
  /** @deprecated Kept for mobile/TV compat — remux always uses h264 fallback. */
  sourceVideoCodec?: string;
  /** Progressive remux (default true). Set false for Safari/iOS (no Range support). */
  useProgressiveRemux?: boolean;
  /** Bitmap subtitle burn-in index (PGS/DVDSUB). */
  subtitleStreamIndex?: number;
  /**
   * Force le BURN-IN (SubtitleMethod=Encode) du `subtitleStreamIndex` dans la
   * vidéo transcodée, au lieu de la livraison HLS texte par défaut. Nécessaire
   * pour l'ASS/SSA sur AVPlayer (tvOS) : la conversion ASS→VTT côté serveur fait
   * fuiter les balises override ({\an8}, signs). Les sous-titres IMAGE (PGS) sont
   * déjà incrustés d'office (impossible en piste texte) → ce flag est inutile pour
   * eux. Non utilisé sur Android (ExoPlayer rend l'ASS nativement).
   */
  burnInSubtitle?: boolean;
}

export interface StreamUrlContext {
  baseUrl: string;
  deviceId: string;
  accessToken: string | null;
  useCredentials: boolean;
  resolveMediaUrl: ResolveMediaUrl;
}

export function buildStreamUrl(
  ctx: StreamUrlContext,
  itemId: string,
  options?: StreamUrlOptions,
): string {
  const p: Record<string, string> = {};
  // When using httpOnly cookies (web), no api_key needed — cookie is sent automatically.
  // Mobile/desktop still need api_key in the URL for stream requests.
  if (!ctx.useCredentials) {
    p.api_key = ctx.accessToken ?? "";
  }
  if (options?.mediaSourceId) p.MediaSourceId = options.mediaSourceId;
  if (options?.audioIndex != null) p.AudioStreamIndex = String(options.audioIndex);
  if (options?.startTimeTicks) p.StartTimeTicks = String(options.startTimeTicks);
  // Server-side burn-in for bitmap subtitles (PGS/DVDSUB)
  if (options?.subtitleStreamIndex != null) p.SubtitleStreamIndex = String(options.subtitleStreamIndex);
  // Burn-in explicite (ASS/SSA sur tvOS) : grave le sous-titre dans la vidéo plutôt
  // que de le livrer en piste HLS texte (cf. buildHlsUrl, qui n'écrasera pas Encode).
  if (options?.burnInSubtitle && options?.subtitleStreamIndex != null) p.SubtitleMethod = "Encode";

  // Direct play — raw file, browser handles codec/track selection
  if (options?.directPlay !== false && !options?.maxBitrate) {
    p.Static = "true";
    return ctx.resolveMediaUrl(`${ctx.baseUrl}/Videos/${itemId}/stream?${buildQuery(p)}`);
  }

  // Shared transcode/remux params
  p.DeviceId = ctx.deviceId;
  if (options?.playSessionId) p.PlaySessionId = options.playSessionId;
  p.TranscodingMaxAudioChannels = "6";
  p.RequireAvc = "false";
  p.context = "Streaming";

  if (!options?.maxBitrate) {
    // Remux: video copy + audio transcode. h264 fallback codec for HW encoding.
    // VideoBitrate/MaxWidth are safety nets if Jellyfin can't copy (HDR tonemapping).
    p.VideoCodec = "h264";
    p.AllowVideoStreamCopy = "true";
    p.AllowAudioStreamCopy = "false";
    p.AudioCodec = "aac";
    p.CopyTimestamps = "true";
    p.VideoBitrate = "139616000";
    p.AudioBitrate = "384000";
    p.MaxWidth = "1920";

    if (options?.useProgressiveRemux !== false) {
      return ctx.resolveMediaUrl(`${ctx.baseUrl}/Videos/${itemId}/stream.mp4?${buildQuery(p)}`);
    }
    // HLS remux fallback (Safari/iOS) — TS segments
    return buildHlsUrl(ctx.baseUrl, itemId, p, ctx.resolveMediaUrl);
  }

  // Transcodage de qualité (palier, ou repli codec) en HLS : débit vidéo,
  // définition et audio décidés ENSEMBLE par `transcodeTarget` (shared) — la
  // règle même qu'applique `applyTranscodeTarget` aux URL que Jellyfin rend aux
  // lecteurs web et mobiles. `MaxWidth` suit le palier : figé à 1920, il
  // laissait Jellyfin choisir seul la définition (un « 480p » servi en 540p).
  const target = transcodeTarget(options.maxBitrate, options.maxHeight);
  p.AllowVideoStreamCopy = "false";
  p.AllowAudioStreamCopy = "false";
  p.EnableAudioVbrEncoding = "true";
  p.CopyTimestamps = "true";
  p.VideoCodec = "h264";
  p.AudioCodec = "aac";
  p.VideoBitrate = String(target.videoBitrate);
  p.AudioBitrate = String(target.audioBitrate);
  p.TranscodingMaxAudioChannels = String(target.audioChannels);
  p.MaxWidth = String(target.maxWidth);
  if (target.maxHeight) p.MaxHeight = String(target.maxHeight);
  return buildHlsUrl(ctx.baseUrl, itemId, p, ctx.resolveMediaUrl);
}

/** Les paramètres qu'un palier impose à une URL de transcodage, quelle que soit leur casse d'origine. */
const TARGET_PARAMS = ["VideoBitrate", "AudioBitrate", "TranscodingMaxAudioChannels", "MaxWidth", "MaxHeight"];

/**
 * Pose un palier de qualité sur l'URL de transcodage que Jellyfin a rendue
 * (`TranscodingUrl` de PlaybackInfo, lecteurs web et mobiles).
 *
 * Jellyfin y écrit `VideoBitrate = plafond − audio` mais aucune définition :
 * au moment du manifeste, il la recalcule d'après ce débit et sert du 720p à
 * 1,2 Mb/s, qui part en blocs à la première scène d'action. On y impose donc
 * le débit, la définition et l'audio du palier — les mêmes que `buildStreamUrl`
 * pose sur les URL des lecteurs natifs. Le reste de l'URL est rendu tel quel,
 * à l'octet près : session, pistes, profils de codecs.
 */
export function applyTranscodeTarget(url: string, target: TranscodeTarget): string {
  const q = url.indexOf("?");
  if (q < 0) return url;
  const replaced = new Set(TARGET_PARAMS.map((k) => k.toLowerCase()));
  const kept = url
    .slice(q + 1)
    .split("&")
    .filter((pair) => pair !== "" && !replaced.has(pair.split("=")[0].toLowerCase()));
  kept.push(
    `VideoBitrate=${target.videoBitrate}`,
    `AudioBitrate=${target.audioBitrate}`,
    `TranscodingMaxAudioChannels=${target.audioChannels}`,
    `MaxWidth=${target.maxWidth}`,
  );
  if (target.maxHeight) kept.push(`MaxHeight=${target.maxHeight}`);
  return `${url.slice(0, q)}?${kept.join("&")}`;
}

/** Sous ce débit vidéo, Jellyfin quitte le 1080p et choisit seul une définition qu'il affame. */
const STARVING_BELOW = TRANSCODE_TIERS.find((t) => t.key === "quality1080p")?.floor ?? 6_500_000;

/** Un paramètre numérique d'une URL de transcodage, quelle que soit sa casse. */
function numericParam(url: string, name: string): number | null {
  const match = new RegExp(`[?&]${name}=(\\d+)`, "i").exec(url);
  return match ? Number(match[1]) : null;
}

/**
 * Le transcodage que JELLYFIN a plafonné de lui-même, en « Originale » : la
 * limite de débit du streaming Internet (du serveur ou du compte) s'applique
 * aux lecteurs distants sans qu'aucun palier n'ait été choisi. Jellyfin écrit
 * alors `VideoBitrate = limite − audio` et choisit seul la définition — le
 * 720p à 1,2 Mb/s qui part en blocs dans l'action. Quand le débit permis est
 * sous celui de la source ET sous le plancher du 1080p — la zone où Jellyfin
 * affame l'encodeur —, on y pose le meilleur palier qui tient dans cette
 * limite (`bestTierForBudget`, shared). Sinon l'URL reste celle de Jellyfin :
 * copie, remux, transcodage de codec à plein débit, ou plafond assez haut pour
 * qu'il garde lui-même le 1080p, voire la 4K d'un téléviseur.
 */
export function fitServerCappedTranscode(url: string, source: MediaSource | null | undefined): string {
  const videoBitrate = numericParam(url, "VideoBitrate");
  const video = source?.MediaStreams?.find((s) => s.Type === "Video");
  const sourceVideoBitrate = video?.BitRate ?? source?.Bitrate;
  if (!videoBitrate || !sourceVideoBitrate || videoBitrate >= sourceVideoBitrate) return url;
  if (videoBitrate >= STARVING_BELOW) return url;
  const tier = bestTierForBudget(source, videoBitrate + (numericParam(url, "AudioBitrate") ?? 0));
  return tier?.bitrate ? applyTranscodeTarget(url, transcodeTarget(tier.bitrate, tier.height)) : url;
}

export function buildHlsUrl(
  baseUrl: string,
  itemId: string,
  p: Record<string, string>,
  resolveMediaUrl: ResolveMediaUrl,
): string {
  // Jellyfin 10.10+ rejects StartTimeTicks on individual .ts segment requests,
  // but propagates all master.m3u8 query params to segment URLs → error.
  // The client must seek to the desired position instead.
  delete p.StartTimeTicks;
  p.BreakOnNonKeyFrames = "true";
  p.RequireNonAnamorphic = "false";
  // Burn-in explicite demandé (ASS/SSA tvOS) : SubtitleMethod=Encode déjà posé →
  // NE PAS l'écraser. Le sous-titre est gravé dans la vidéo (pas de piste manifeste).
  if (p.SubtitleMethod !== "Encode") {
    // Sous-titres TEXTE dans le manifeste HLS (#EXT-X-MEDIA:TYPE=SUBTITLES) :
    // indispensable pour qu'AVPlayer (tvOS) les rende NATIVEMENT et bascule entre
    // eux INSTANTANÉMENT (toutes les pistes texte sont dans le manifeste). Sans
    // `SubtitleMethod=Hls`, Jellyfin n'émet AUCUNE piste subtitle (même avec
    // EnableSubtitlesInManifest). Les sous-titres image (PGS) restent incrustés
    // d'office côté serveur (impossible en piste texte).
    p.EnableSubtitlesInManifest = "true";
    p.SubtitleMethod = "Hls";
  }
  p.SegmentContainer = "ts";
  p.MinSegments = "2";
  return resolveMediaUrl(`${baseUrl}/Videos/${itemId}/master.m3u8?${buildQuery(p)}`);
}

export function buildSubtitleUrl(
  baseUrl: string,
  itemId: string,
  mediaSourceId: string,
  streamIndex: number,
  format: string,
  accessToken: string | null,
  useCredentials: boolean,
): string {
  // Always proxy — <track> elements enforce CORS; cross-origin tracks are blocked
  // (and on browsers with crossOrigin="anonymous", they corrupt the <video> element).
  const base = `${baseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/Stream.${format}`;
  return useCredentials ? base : `${base}?api_key=${accessToken}`;
}
