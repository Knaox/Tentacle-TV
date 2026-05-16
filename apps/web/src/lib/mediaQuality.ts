import type { MediaItem, MediaStream } from "@tentacle-tv/shared";

export type Resolution = "4K" | "FHD" | "HD" | "SD";

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

function resolutionFromWidth(width?: number): Resolution | null {
  if (!width) return null;
  if (width >= 3840) return "4K";
  if (width >= 1920) return "FHD";
  if (width >= 1280) return "HD";
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
  // français
  fra: "FR", fre: "FR", fr: "FR",
  // anglais → US par défaut (peut être surchargé par un title "British")
  eng: "US", en: "US",
  // japonais
  jpn: "JP", ja: "JP", jap: "JP",
  // espagnol → Espagne (Latin America pourrait être différencié plus tard)
  spa: "ES", es: "ES",
  // allemand
  ger: "DE", deu: "DE", de: "DE",
  // italien
  ita: "IT", it: "IT",
  // portugais → BR (audio majoritaire sur les VOD) ; pt-pt rare en VOD
  por: "BR", pt: "BR",
  // coréen
  kor: "KR", ko: "KR",
  // chinois (mandarin standard)
  chi: "CN", zho: "CN", zh: "CN",
  // russe
  rus: "RU", ru: "RU",
  // arabe → arabie saoudite par défaut (langue véhiculaire)
  ara: "SA", ar: "SA",
  // hindi
  hin: "IN", hi: "IN",
  // néerlandais
  nld: "NL", dut: "NL", nl: "NL",
  // polonais
  pol: "PL", pl: "PL",
  // turc
  tur: "TR", tr: "TR",
  // suédois / norvégien / danois / finlandais
  swe: "SE", sv: "SE",
  nor: "NO", no: "NO", nb: "NO",
  dan: "DK", da: "DK",
  fin: "FI", fi: "FI",
};

/**
 * Convertit un code pays ISO 3166-1 alpha-2 en emoji drapeau via les
 * Regional Indicator Symbols. Pure Unicode — pas de dépendance asset.
 */
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

/** Heuristique VF Canadien (français du Québec) — détectée via les marqueurs
 *  régionaux que Jellyfin embarque dans DisplayTitle ou Title : "Canadien",
 *  "Canadian", "Québec", "VFQ", etc. Sur ces pistes on émet un drapeau
 *  composite FR+CA pour distinguer de la VF métropolitaine. */
function isFrenchCanadian(stream: MediaStream): boolean {
  const probe = `${stream.DisplayTitle ?? ""} ${stream.Title ?? ""}`.toLowerCase();
  return /\b(canad|qu[ée]bec|vfq|qc\b)/i.test(probe);
}

function extractAudioFlags(streams: MediaStream[]): AudioFlag[] {
  // Pistes audio dans l'ordre Jellyfin : défaut d'abord (IsDefault=true), reste après.
  const audios = streams
    .filter((s) => s.Type === "Audio" && s.Language)
    .sort((a, b) => Number(b.IsDefault) - Number(a.IsDefault));

  const seen = new Set<string>();
  const result: AudioFlag[] = [];
  for (const s of audios) {
    const lang = (s.Language ?? "").toLowerCase().slice(0, 3);
    const cc = LANGUAGE_TO_COUNTRY[lang] ?? LANGUAGE_TO_COUNTRY[lang.slice(0, 2)];
    if (!cc) continue;

    // Cas spécial : si c'est du français ET détecté Québécois → composite FR+CA
    // (countryCode distinct "FR-CA" pour pouvoir coexister avec une VF FR pure).
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

/**
 * Extract a normalized quality summary from a MediaItem.
 * Tolerant to missing MediaSources (returns mostly-null result so callers
 * can render nothing without conditionals everywhere).
 */
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
