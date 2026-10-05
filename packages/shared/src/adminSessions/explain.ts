import type { AdminSessionDto } from "../types/adminSessionsDto";
import { deliveryOf, type DeliveryKind } from "./delivery";
import { acceleratorLabel, channelsLabel, codecLabel, formatBitrate, rangeLabel, resolutionLabel } from "./format";

/**
 * Pourquoi le serveur travaille, en mots d'administrateur — la lecture des
 * `TranscodeReasons` de Jellyfin (10.11), de ce qui change, et de l'encodeur.
 * Les cartes du bureau et du mobile ne font que l'afficher : une seule règle,
 * des phrases traduites (espace `sessions`, `reason.*`).
 *
 * Une raison porte ses détails quand on les connaît (« le conteneur MKV »,
 * « la vidéo HEVC ») ; sans eux, la phrase générique (`reason.X_generic`).
 */

/** Les raisons de Jellyfin, de la plus décisive à la plus anodine : l'ordre de lecture. */
const REASON_ORDER = [
  "SubtitleCodecNotSupported",
  "VideoCodecNotSupported",
  "VideoRangeTypeNotSupported",
  "VideoProfileNotSupported",
  "VideoBitDepthNotSupported",
  "VideoLevelNotSupported",
  "VideoCodecTagNotSupported",
  "VideoResolutionNotSupported",
  "VideoFramerateNotSupported",
  "RefFramesNotSupported",
  "AnamorphicVideoNotSupported",
  "InterlacedVideoNotSupported",
  "ContainerBitrateExceedsLimit",
  // Pas une raison de Jellyfin : la NÔTRE, quand il n'en donne aucune et que le
  // débit servi est sous celui de la source — un plafond que l'appareil a
  // demandé sans le dire (bureau et TV jusqu'à 1.26, cf. `reasonLines`).
  "ClientBitrateLimit",
  "VideoBitrateNotSupported",
  "AudioCodecNotSupported",
  "AudioChannelsNotSupported",
  "AudioProfileNotSupported",
  "AudioSampleRateNotSupported",
  "AudioBitDepthNotSupported",
  "AudioBitrateNotSupported",
  "AudioIsExternal",
  "SecondaryAudioNotSupported",
  "ContainerNotSupported",
  "StreamCountExceedsLimit",
  "UnknownVideoStreamInfo",
  "UnknownAudioStreamInfo",
  "DirectPlayError",
] as const;

export type TranscodeReasonKey = (typeof REASON_ORDER)[number];

/** Toutes les raisons que le tableau de bord sait dire, dans leur ordre de lecture. */
export const TRANSCODE_REASONS: readonly TranscodeReasonKey[] = REASON_ORDER;

const RANK: ReadonlyMap<string, number> = new Map(REASON_ORDER.map((r, i) => [r, i]));

/** Le débit plafonné se dit une fois, quelle que soit la raison de Jellyfin qui le porte. */
const SAME_LINE: Readonly<Record<string, string>> = { VideoBitrateNotSupported: "ContainerBitrateExceedsLimit" };

export interface ReasonLine {
  /** La raison telle que Jellyfin l'écrit (`VideoCodecNotSupported`…). */
  reason: string;
  /** Connue de cette version : sinon, on l'humanise (`humanizeReason`). */
  known: boolean;
  /** Les détails qui la rendent concrète, ou `null` : la phrase générique. */
  params: Record<string, string> | null;
}

export interface PlaybackExplanation {
  kind: DeliveryKind;
  reasons: ReasonLine[];
  /** Ce que le serveur change : « HEVC → H.264 », « 4K → 1080p », « TrueHD 5.1 → AAC 2.0 ». */
  changes: string[];
  /** L'encodeur de l'image réencodée (« NVENC »), `"software"`, ou `null` (rien de réencodé, ou inconnu). */
  encoder: string | null;
}

const CONTAINERS: Readonly<Record<string, string>> = {
  mkv: "MKV", matroska: "MKV", webm: "WebM", mp4: "MP4", m4v: "MP4", mov: "MOV", ts: "TS", mpegts: "TS",
  m2ts: "M2TS", avi: "AVI", wmv: "WMV", asf: "WMV", flv: "FLV", ogg: "OGG", hls: "HLS",
};

/** `mkv` → « MKV » ; la liste qu'écrit Jellyfin pour un MP4 (`mov,mp4,m4a,…`) → « MP4 ». */
export function containerLabel(raw?: string): string | null {
  if (!raw) return null;
  const parts = raw.toLowerCase().split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.includes("mp4")) return "MP4";
  const first = parts[0];
  if (first === undefined) return null;
  return CONTAINERS[first] ?? first.toUpperCase();
}

const SUBTITLES: Readonly<Record<string, string>> = {
  pgssub: "PGS", hdmv_pgs_subtitle: "PGS", pgs: "PGS", dvdsub: "VobSub", dvd_subtitle: "VobSub", vobsub: "VobSub",
  dvbsub: "DVB", dvb_subtitle: "DVB", ass: "ASS", ssa: "SSA", subrip: "SRT", srt: "SRT", webvtt: "WebVTT", vtt: "WebVTT",
  mov_text: "MOV text",
};

export function subtitleLabel(codec?: string): string | null {
  if (!codec) return null;
  return SUBTITLES[codec.toLowerCase()] ?? codec.toUpperCase();
}

/** Sous ce seuil, le débit d'un flux est une valeur d'en-tête sans rapport avec le fichier. */
const PLAUSIBLE_BITRATE = 64_000;

/** Les raisons qui se disent avec leurs détails — sans eux, leur forme `_generic`. */
export const REASONS_WITH_DETAILS: ReadonlySet<string> = new Set([
  "ContainerNotSupported", "VideoCodecNotSupported", "AudioCodecNotSupported", "SubtitleCodecNotSupported",
  "VideoRangeTypeNotSupported", "AudioChannelsNotSupported", "VideoBitDepthNotSupported", "VideoProfileNotSupported",
  "VideoResolutionNotSupported",
]);

function params(reason: string, session: Pick<AdminSessionDto, "source">): Record<string, string> | null {
  const s = session.source;
  const one = (key: string, value: string | null | undefined) => (value ? { [key]: value } : null);
  switch (reason) {
    case "ContainerNotSupported": return one("container", containerLabel(s?.container));
    case "VideoCodecNotSupported": return one("codec", codecLabel(s?.videoCodec));
    case "AudioCodecNotSupported": return one("codec", codecLabel(s?.audioCodec));
    case "SubtitleCodecNotSupported": return one("format", subtitleLabel(s?.subtitleCodec));
    case "VideoRangeTypeNotSupported": return one("range", rangeLabel(s?.videoRange));
    case "AudioChannelsNotSupported": return one("channels", channelsLabel(s?.audioChannels));
    case "VideoBitDepthNotSupported": return one("depth", s?.videoBitDepth ? String(s.videoBitDepth) : null);
    case "VideoProfileNotSupported": return one("profile", s?.videoProfile);
    case "VideoResolutionNotSupported": return one("resolution", resolutionLabel(s?.width, s?.height));
    default: return null;
  }
}

/** Le débit d'une source, s'il est vraisemblable. */
function sourceBitrate(session: Pick<AdminSessionDto, "source">): number | null {
  const rate = session.source?.bitrate;
  return rate && rate >= PLAUSIBLE_BITRATE ? rate : null;
}

function reasonLines(session: Pick<AdminSessionDto, "source" | "transcoding">, kind: DeliveryKind): ReasonLine[] {
  const raw = session.transcoding?.reasons ?? [];
  // Jellyfin n'a reçu aucune raison (URL construite par le client, sans
  // `TranscodeReasons`) mais l'image sort sous le débit de la source : c'est
  // un plafond de débit demandé par l'appareil — pas une incompatibilité.
  const served = session.transcoding?.bitrate;
  const sourceRate = sourceBitrate(session);
  if (raw.length === 0 && kind === "video" && served && sourceRate !== null && served < sourceRate) {
    return [{ reason: "ClientBitrateLimit", known: true, params: null }];
  }
  const seen = new Set<string>();
  const lines: ReasonLine[] = [];
  for (const reason of raw) {
    const line = SAME_LINE[reason] ?? reason;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push({ reason: line, known: RANK.has(line), params: params(line, session) });
  }
  // Tri stable : l'ordre de Jellyfin départage, une raison inconnue va au bout.
  return lines
    .map((line, index) => ({ line, index, rank: RANK.get(line.reason) ?? REASON_ORDER.length }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ line }) => line);
}

/** « TrueHD 5.1 » : les éléments présents, séparés d'une espace. */
function spaced(parts: ReadonlyArray<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => typeof p === "string" && p !== "");
  return kept.length > 0 ? kept.join(" ") : null;
}

function arrow(from: string | null, to: string | null): string | null {
  if (!to) return null;
  if (!from) return to;
  return from === to ? null : `${from} → ${to}`;
}

function changes(session: Pick<AdminSessionDto, "source" | "transcoding">, kind: DeliveryKind, locale: string): string[] {
  const { source: s, transcoding: t } = session;
  if (t === null || kind === "direct") return [];
  if (kind === "remux") {
    const container = arrow(containerLabel(s?.container), containerLabel(t.container));
    return container ? [container] : [];
  }
  const out: Array<string | null> = [];
  if (kind === "video") {
    out.push(arrow(codecLabel(s?.videoCodec), codecLabel(t.videoCodec)));
    out.push(arrow(resolutionLabel(s?.width, s?.height), resolutionLabel(t.width, t.height)));
    // Une image HDR réencodée en H.264 (8 bits) passe forcément en SDR — Jellyfin
    // la convertit (mappage tonal) ; il le dit aussi quand l'écran ne sait pas.
    const range = rangeLabel(s?.videoRange);
    const toSdr = t.reasons.includes("VideoRangeTypeNotSupported") || t.videoCodec?.toLowerCase() === "h264";
    if (range && toSdr) out.push(`${range} → SDR`);
    // Le débit de Jellyfin est un PLAFOND : il ne dit quelque chose que s'il
    // est sous celui de la source (un palier, une limite). Au-dessus, il n'a
    // rien changé — « 11 Mb/s → 18 Mb/s » se lirait comme un gonflement.
    const sourceRate = sourceBitrate(session);
    if (t.bitrate && (sourceRate === null || t.bitrate < sourceRate)) {
      out.push(arrow(sourceRate === null ? null : formatBitrate(sourceRate, locale), formatBitrate(t.bitrate, locale)));
    }
  }
  if (!t.isAudioDirect) {
    out.push(arrow(
      spaced([codecLabel(s?.audioCodec), channelsLabel(s?.audioChannels)]),
      spaced([codecLabel(t.audioCodec), channelsLabel(t.audioChannels)]),
    ));
  }
  return out.filter((c): c is string => c !== null);
}

function encoder(session: Pick<AdminSessionDto, "transcoding">, kind: DeliveryKind): string | null {
  const type = session.transcoding?.hardwareAccelerationType;
  if (kind !== "video" || type === undefined) return null;
  return acceleratorLabel(type) ?? "software";
}

/** Comment le média arrive, pourquoi, ce qui change, et qui encode. */
export function explainPlayback(
  session: Pick<AdminSessionDto, "playMethod" | "transcoding" | "nowPlaying" | "source">,
  locale: string,
): PlaybackExplanation {
  const kind = deliveryOf(session);
  return {
    kind,
    reasons: kind === "direct" ? [] : reasonLines(session, kind),
    changes: changes(session, kind, locale),
    encoder: encoder(session, kind),
  };
}

/** La clé de traduction d'une raison : avec ses détails, ou sa forme générique. */
export function reasonKey(line: ReasonLine): string {
  return REASONS_WITH_DETAILS.has(line.reason) && line.params === null ? `reason.${line.reason}_generic` : `reason.${line.reason}`;
}
