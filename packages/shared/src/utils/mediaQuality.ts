import type { MediaItem, MediaStream } from "../types/media";

export type Resolution = "4K" | "FHD" | "HD" | "SD";
export type SourceResolution = "4K" | "1080p" | "720p" | "SD";

export interface AudioLabel {
  /** Token court affiché à l'écran : "VF", "VFQ", "VOSTFR", "EN", "JP"… */
  token: string;
  /** Libellé complet pour l'aria-label / le title ("Français", "Japonais"…). */
  full: string;
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
  /**
   * Langues audio résumées en tokens texte (VF / VFQ / VOSTFR / EN / JP…),
   * défaut en premier, dédupliquées. Remplace les drapeaux pays : plus
   * discret et parfaitement cohérent avec l'UI sombre.
   */
  audioLabels: AudioLabel[];
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
  key: "original" | "quality1080pHigh" | "quality1080p" | "quality720p" | "quality480p";
  /** Débit max envoyé au serveur Jellyfin (bps). `null` = pas de cap (direct play). */
  bitrate: number | null;
  /** Largeur max pour le cap visuel (px). `null` = pas de redimensionnement. */
  width: number | null;
  /** Hauteur max pour le cap visuel (px). `null` = pas de redimensionnement. */
  height: number | null;
}

/**
 * Liste de REPLI, servie quand le débit de la source est inconnu — un barème
 * approximatif vaut mieux qu'un sélecteur vide. Dans tous les autres cas, c'est
 * `construireEchelleQualite` (utils/qualityLadder) qui fait foi : ces débits-là
 * sont fixes et peuvent dépasser celui du fichier lu.
 */
export const QUALITY_PRESETS: readonly QualityPreset[] = [
  { key: "original",     bitrate: null,        width: null, height: null },
  { key: "quality1080p", bitrate: 30_000_000,  width: 1920, height: 1080 },
  { key: "quality720p",  bitrate: 10_000_000,  width: 1280, height: 720 },
  { key: "quality480p",  bitrate:  4_000_000,  width:  854, height: 480 },
] as const;

export type QualityKey = QualityPreset["key"];

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

/**
 * Pays ISO 3166-1 → token audio texte + libellé complet.
 * On garde une convention "version" pour le français (VF) et des codes
 * langue courts et lisibles pour le reste (EN, JP, ES…), façon plateformes FR.
 */
const COUNTRY_TO_AUDIO: Record<string, { token: string; full: string }> = {
  FR: { token: "VF", full: "Français" },
  US: { token: "EN", full: "Anglais" },
  JP: { token: "JP", full: "Japonais" },
  ES: { token: "ES", full: "Espagnol" },
  DE: { token: "DE", full: "Allemand" },
  IT: { token: "IT", full: "Italien" },
  BR: { token: "PT", full: "Portugais" },
  KR: { token: "KR", full: "Coréen" },
  CN: { token: "ZH", full: "Chinois" },
  RU: { token: "RU", full: "Russe" },
  SA: { token: "AR", full: "Arabe" },
  IN: { token: "HI", full: "Hindi" },
  NL: { token: "NL", full: "Néerlandais" },
  PL: { token: "PL", full: "Polonais" },
  TR: { token: "TR", full: "Turc" },
  SE: { token: "SV", full: "Suédois" },
  NO: { token: "NO", full: "Norvégien" },
  DK: { token: "DA", full: "Danois" },
  FI: { token: "FI", full: "Finnois" },
};

function isFrenchCanadian(stream: MediaStream): boolean {
  const probe = `${stream.DisplayTitle ?? ""} ${stream.Title ?? ""}`.toLowerCase();
  return /\b(canad|qu[ée]bec|vfq|qc\b)/i.test(probe);
}

function hasFrenchSubtitle(streams: MediaStream[]): boolean {
  return streams.some(
    (s) => s.Type === "Subtitle" && /^(fr|fra|fre)/.test((s.Language ?? "").toLowerCase()),
  );
}

/**
 * Résume les pistes audio (+ sous-titres) en tokens texte discrets :
 *  • Français → VF (VFQ si variante québécoise détectée dans le titre)
 *  • Autres langues → code court (EN, JP, ES, DE…)
 *  • VOSTFR ajouté en tête si AUCUN audio français mais sous-titres FR présents.
 * Défaut en premier, dédupliqué par token.
 */
function extractAudioLabels(streams: MediaStream[]): AudioLabel[] {
  const audios = streams
    .filter((s) => s.Type === "Audio" && s.Language)
    .sort((a, b) => Number(b.IsDefault) - Number(a.IsDefault));

  const seen = new Set<string>();
  const result: AudioLabel[] = [];
  for (const s of audios) {
    const lang = (s.Language ?? "").toLowerCase().slice(0, 3);
    const cc = LANGUAGE_TO_COUNTRY[lang] ?? LANGUAGE_TO_COUNTRY[lang.slice(0, 2)];
    const base = cc ? COUNTRY_TO_AUDIO[cc] : undefined;
    if (!base) continue;

    let token = base.token;
    let full = base.full;
    if (cc === "FR" && isFrenchCanadian(s)) {
      token = "VFQ";
      full = "Français (Québec)";
    }
    if (seen.has(token)) continue;
    seen.add(token);
    result.push({ token, full });
  }

  // VOSTFR : version originale sous-titrée français (pas de doublage FR).
  if (!seen.has("VF") && !seen.has("VFQ") && hasFrenchSubtitle(streams)) {
    result.unshift({ token: "VOSTFR", full: "Version originale sous-titrée français" });
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
    audioLabels: [],
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
    audioLabels: extractAudioLabels(streams),
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
