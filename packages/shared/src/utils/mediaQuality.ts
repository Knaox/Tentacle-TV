import type { MediaItem, MediaStream } from "../types/media";

export type Resolution = "4K" | "FHD" | "HD" | "SD";
export type SourceResolution = "4K" | "1080p" | "720p" | "SD";

export interface AudioFlag {
  /** ISO 3166-1 alpha-2 (FR, JP, US…) ou composite ("FR-CA" pour VF Québec). */
  countryCode: string;
  /** Emoji drapeau primaire prêt à rendre (Apple Color Emoji macOS/iOS). */
  flag: string;
  /** Drapeau secondaire optionnel — utilisé pour VF Canadien (CA après FR). */
  secondaryFlag?: string;
  /** Code langue ISO 639 d'origine (fra/fre/jpn…), utile pour aria-label. */
  languageCode: string;
}

export interface MediaQuality {
  resolution: Resolution | null;
  /** Codec vidéo HEVC/H.265 (signal d'encodage moderne, meilleur que H.264). */
  isHEVC: boolean;
  isHDR: boolean;
  /** Specifically Dolby Vision (distinct from generic HDR10/HLG). */
  isDolbyVision: boolean;
  /** Dolby Atmos detected on the primary audio track. */
  isDolbyAtmos: boolean;
  /** Dolby Digital ou Digital+ (ac3 / eac3) — afficher seulement si pas d'Atmos. */
  isDolbyDigital: boolean;
  /** Surround channel layout label (e.g. "5.1", "7.1") if available. */
  surroundLabel: "5.1" | "7.1" | null;
  /** Pistes audio uniques (défaut en premier), dédupliquées par drapeau. */
  audioFlags: AudioFlag[];
}

/** Forme compacte utilisée par les sélecteurs de qualité in-player. */
export interface SourceQuality {
  resolution: SourceResolution | null;
  isHDR: boolean;
  isDolbyVision: boolean;
  isDolbyAtmos: boolean;
}

export interface QualityPreset {
  /** Clé i18n stable (`original`, `quality1080p`, …) */
  key: "original" | "quality1080p" | "quality720p" | "quality480p";
  /** Débit max envoyé au serveur Jellyfin (bps). `null` = pas de cap (direct play). */
  bitrate: number | null;
  /** Largeur max pour le cap visuel (px). `null` = pas de redimensionnement. */
  width: number | null;
  /** Hauteur max pour le cap visuel (px). `null` = pas de redimensionnement. */
  height: number | null;
}

/**
 * Presets de qualité partagés entre web, desktop Tauri, mobile Expo et Android TV.
 * Les débits sont alignés sur les valeurs convenues : 30/10/4 Mbps.
 */
export const QUALITY_PRESETS: readonly QualityPreset[] = [
  { key: "original",     bitrate: null,        width: null, height: null },
  { key: "quality1080p", bitrate: 30_000_000,  width: 1920, height: 1080 },
  { key: "quality720p",  bitrate: 10_000_000,  width: 1280, height: 720 },
  { key: "quality480p",  bitrate:  4_000_000,  width:  854, height: 480 },
] as const;

export type QualityKey = QualityPreset["key"];

export function findPreset(key: QualityKey): QualityPreset {
  return QUALITY_PRESETS.find((p) => p.key === key) ?? QUALITY_PRESETS[0];
}

/** "30 Mbps", "4 Mbps", "1.5 Mbps" — null/0 → chaîne vide pour Original. */
export function formatBitrateMbps(bps: number | null | undefined): string {
  if (!bps || bps <= 0) return "";
  const mbps = bps / 1_000_000;
  const rounded = mbps >= 10 ? Math.round(mbps) : Math.round(mbps * 10) / 10;
  return `${rounded} Mbps`;
}

function resolutionFromWidth(width?: number): Resolution | null {
  if (!width) return null;
  if (width >= 3840) return "4K";
  if (width >= 1920) return "FHD";
  if (width >= 1280) return "HD";
  return "SD";
}

/** Variante pour les sélecteurs qualité — utilise des labels lisibles côté UI. */
function sourceResolutionFromWidth(width?: number): SourceResolution | null {
  if (!width) return null;
  if (width >= 3840) return "4K";
  if (width >= 1920) return "1080p";
  if (width >= 1280) return "720p";
  return "SD";
}

function detectDolbyVision(stream?: MediaStream): boolean {
  if (!stream) return false;
  const range = stream.VideoRangeType?.toUpperCase() ?? "";
  // Jellyfin uses DOVI / DOLBYVISION / "DOVI HDR10" depending on the source.
  return range.includes("DOVI") || range.includes("DOLBY");
}

function detectAtmos(stream?: MediaStream): boolean {
  if (!stream) return false;
  // Best signal: DisplayTitle contains "Atmos" (Jellyfin enriches it from
  // codec profile). Fallback heuristic on codec when title is absent.
  const title = stream.DisplayTitle?.toLowerCase() ?? "";
  if (title.includes("atmos")) return true;
  const codec = stream.Codec?.toLowerCase() ?? "";
  return codec === "truehd";
}

function surroundFromChannels(channels?: number): MediaQuality["surroundLabel"] {
  if (!channels) return null;
  if (channels >= 8) return "7.1";
  if (channels >= 6) return "5.1";
  return null;
}

/**
 * Map langue ISO 639 (fra/fre/jpn/jap/eng…) → pays ISO 3166-1 alpha-2.
 * Couvre les langues les plus fréquentes sur du contenu multimédia.
 * Pour les anglophones on retient le drapeau US par convention industrie.
 */
const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  fra: "FR", fre: "FR", fr: "FR",
  eng: "US", en: "US",
  jpn: "JP", ja: "JP", jap: "JP",
  spa: "ES", es: "ES",
  ger: "DE", deu: "DE", de: "DE",
  ita: "IT", it: "IT",
  por: "BR", pt: "BR",
  kor: "KR", ko: "KR",
  chi: "CN", zho: "CN", zh: "CN",
  rus: "RU", ru: "RU",
  ara: "SA", ar: "SA",
  hin: "IN", hi: "IN",
  nld: "NL", dut: "NL", nl: "NL",
  pol: "PL", pl: "PL",
  tur: "TR", tr: "TR",
  swe: "SE", sv: "SE",
  nor: "NO", no: "NO", nb: "NO",
  dan: "DK", da: "DK",
  fin: "FI", fi: "FI",
};

function countryToFlag(cc: string): string {
  const code = cc.toUpperCase();
  if (code.length !== 2) return "";
  const A = 0x41;
  const RIS = 0x1f1e6;
  return String.fromCodePoint(
    code.charCodeAt(0) - A + RIS,
    code.charCodeAt(1) - A + RIS,
  );
}

function isFrenchCanadian(stream: MediaStream): boolean {
  const probe = `${stream.DisplayTitle ?? ""} ${stream.Title ?? ""}`.toLowerCase();
  return /\b(canad|qu[ée]bec|vfq|qc\b)/i.test(probe);
}

function extractAudioFlags(streams: MediaStream[]): AudioFlag[] {
  const audios = streams
    .filter((s) => s.Type === "Audio" && s.Language)
    .sort((a, b) => Number(b.IsDefault) - Number(a.IsDefault));

  const seen = new Set<string>();
  const result: AudioFlag[] = [];
  for (const s of audios) {
    const lang = (s.Language ?? "").toLowerCase().slice(0, 3);
    const cc = LANGUAGE_TO_COUNTRY[lang] ?? LANGUAGE_TO_COUNTRY[lang.slice(0, 2)];
    if (!cc) continue;

    const isFRCA = cc === "FR" && isFrenchCanadian(s);
    const key = isFRCA ? "FR-CA" : cc;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      countryCode: key,
      flag: countryToFlag(cc),
      secondaryFlag: isFRCA ? countryToFlag("CA") : undefined,
      languageCode: lang,
    });
  }
  return result;
}

export function extractMediaQuality(item: MediaItem | undefined | null): MediaQuality {
  const empty: MediaQuality = {
    resolution: null,
    isHEVC: false,
    isHDR: false,
    isDolbyVision: false,
    isDolbyAtmos: false,
    isDolbyDigital: false,
    surroundLabel: null,
    audioFlags: [],
  };
  if (!item) return empty;

  const streams: MediaStream[] = item.MediaSources?.[0]?.MediaStreams ?? [];
  if (streams.length === 0) return empty;

  const video = streams.find((s) => s.Type === "Video");
  const audio = streams.find((s) => s.Type === "Audio" && s.IsDefault) ?? streams.find((s) => s.Type === "Audio");

  const range = video?.VideoRangeType?.toUpperCase() ?? "SDR";
  const isDolbyVision = detectDolbyVision(video);
  const vcodec = video?.Codec?.toLowerCase() ?? "";
  const acodec = audio?.Codec?.toLowerCase() ?? "";

  return {
    resolution: resolutionFromWidth(video?.Width),
    isHEVC: vcodec === "hevc" || vcodec === "h265",
    isHDR: range !== "SDR" && !isDolbyVision,
    isDolbyVision,
    isDolbyAtmos: detectAtmos(audio),
    isDolbyDigital: acodec === "ac3" || acodec === "eac3",
    surroundLabel: surroundFromChannels(audio?.Channels),
    audioFlags: extractAudioFlags(streams),
  };
}

/**
 * Forme compacte utilisée par les sélecteurs de qualité in-player.
 * Tolérant aux items sans MediaSources (resolution = null sans bavarder).
 */
export function extractSourceQuality(item: MediaItem | undefined | null): SourceQuality {
  const empty: SourceQuality = {
    resolution: null,
    isHDR: false,
    isDolbyVision: false,
    isDolbyAtmos: false,
  };
  if (!item) return empty;

  const streams: MediaStream[] = item.MediaSources?.[0]?.MediaStreams ?? [];
  if (streams.length === 0) return empty;

  const video = streams.find((s) => s.Type === "Video");
  const audio = streams.find((s) => s.Type === "Audio" && s.IsDefault) ?? streams.find((s) => s.Type === "Audio");

  const range = video?.VideoRangeType?.toUpperCase() ?? "SDR";
  const isDolbyVision = detectDolbyVision(video);

  return {
    resolution: sourceResolutionFromWidth(video?.Width),
    isHDR: range !== "SDR" && !isDolbyVision,
    isDolbyVision,
    isDolbyAtmos: detectAtmos(audio),
  };
}
