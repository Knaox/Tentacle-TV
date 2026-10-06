import { SAFE_FALLBACK_ENGINE, planStream, type AudioSource, type EngineCapabilities } from "@tentacle-tv/shared";
import { buildQuery } from "./types";
import { imageBudget } from "../net/dataSaver";
import { pixelDensity } from "../net/pixelDensity";

// Les paliers posés sur les URL que rend Jellyfin (web, mobile, LG) : `transcodingUrl.ts`.
export { applyTranscodeTarget, fitServerCappedTranscode, type TranscodeTier } from "./transcodingUrl";

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
  /**
   * Pourquoi le serveur transcode, dit à Jellyfin (`TranscodeReasons`, noms de
   * son énumération). Sans ce paramètre, une URL construite ici arrive chez
   * Jellyfin SANS raison : il enregistre `TranscodeReasons: null`, et le
   * tableau de bord ne sait plus distinguer un plafond de débit d'une
   * incompatibilité. Par défaut : `ContainerBitrateExceedsLimit` sur la branche
   * du débit (palier, baisse automatique), plus `SubtitleCodecNotSupported`
   * quand un sous-titre est incrusté. Un repli après erreur passe la sienne
   * (`DirectPlayError`) ; un chemin qui a vu PlaybackInfo, celles de Jellyfin.
   */
  transcodeReasons?: readonly string[];
  /**
   * Ce que le moteur qui lira sait décoder (`engineCapabilities.ts`, shared) :
   * c'est lui qui décide du codec de sortie, des plages HDR gardées et de la
   * copie du son (`planStream`). Absent : le repli sûr, H.264 + AAC.
   */
  engine?: EngineCapabilities;
  /** La piste audio lue, telle que la fiche la décrit — pour la copier si le moteur la lit. */
  sourceAudio?: AudioSource | null;
}

/** Les raisons d'une URL de transcodage : celles de l'appelant, sinon celles de la branche. */
function transcodeReasons(options: StreamUrlOptions | undefined, bitrateCap: boolean): string | null {
  const reasons = new Set(options?.transcodeReasons ?? []);
  if (reasons.size === 0 && bitrateCap) reasons.add("ContainerBitrateExceedsLimit");
  if (options?.subtitleStreamIndex != null && options.subtitleStreamIndex >= 0) reasons.add("SubtitleCodecNotSupported");
  return reasons.size > 0 ? [...reasons].join(",") : null;
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

  const reasons = transcodeReasons(options, Boolean(options?.maxBitrate));
  if (reasons) p.TranscodeReasons = reasons;

  // Ce que le moteur lit décide de tout le reste (`planStream`, shared) : sans
  // palier, l'image est COPIÉE — HDR et Dolby Vision compris, aucune
  // définition imposée — et le son l'est aussi quand le moteur le décode ;
  // avec un palier, débit vidéo, définition et budget audio vont ensemble, le
  // son copié sortant du budget de l'image. La même règle que celle
  // qu'applique `applyTranscodeTarget` aux URL que rend Jellyfin.
  const engine = options?.engine ?? SAFE_FALLBACK_ENGINE;
  const tier = options?.maxBitrate ? { totalBitrate: options.maxBitrate, height: options.maxHeight } : null;
  const progressive = !tier && options?.useProgressiveRemux !== false;
  // Le remux progressif est un MP4 : les règles du fMP4 valent (pas d'AC3 copié).
  const plan = planStream({
    engine: progressive ? { ...engine, segmentContainer: "mp4" } : engine,
    audio: options?.sourceAudio, tier,
  });
  Object.assign(p, plan.params);
  p.CopyTimestamps = "true";

  if (progressive) {
    delete p.SegmentContainer;
    return ctx.resolveMediaUrl(`${ctx.baseUrl}/Videos/${itemId}/stream.mp4?${buildQuery(p)}`);
  }
  return buildHlsUrl(ctx.baseUrl, itemId, p, ctx.resolveMediaUrl);
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
  p.SegmentContainer ??= "ts";
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
