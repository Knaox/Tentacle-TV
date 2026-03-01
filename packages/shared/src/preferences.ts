// ── Types ──

export type SubtitleMode = "none" | "always" | "forced" | "signs";

export interface LibraryPreference {
  id?: string;
  jellyfinUserId: string;
  libraryId: string;
  audioLang: string | null;
  subtitleLang: string | null;
  subtitleMode: SubtitleMode;
}

export interface AudioTrackInfo {
  index: number;
  language?: string;
  isDefault?: boolean;
  title?: string;
}

export interface SubtitleTrackInfo {
  index: number;
  language?: string;
  isForced?: boolean;
  title?: string;
}

export interface TrackResolution {
  audioIndex: number | null;
  subtitleIndex: number | null;
}

// ── Language display list ──

export const LANGUAGES = [
  { code: "fre", label: "Français" },
  { code: "fre-vff", label: "Français VFF" },
  { code: "fre-vfq", label: "Français VFQ" },
  { code: "eng", label: "English" },
  { code: "jpn", label: "Japonais" },
  { code: "ger", label: "Allemand" },
  { code: "spa", label: "Espagnol" },
  { code: "ita", label: "Italien" },
  { code: "por", label: "Portugais" },
  { code: "rus", label: "Russe" },
  { code: "kor", label: "Coréen" },
  { code: "chi", label: "Chinois" },
  { code: "ara", label: "Arabe" },
  { code: "pol", label: "Polonais" },
  { code: "dut", label: "Néerlandais" },
  { code: "cze", label: "Tchèque" },
  { code: "hin", label: "Hindi" },
  { code: "tha", label: "Thaï" },
  { code: "swe", label: "Suédois" },
  { code: "nor", label: "Norvégien" },
  { code: "fin", label: "Finnois" },
  { code: "tur", label: "Turc" },
  { code: "hun", label: "Hongrois" },
  { code: "rum", label: "Roumain" },
  { code: "gre", label: "Grec" },
  { code: "dan", label: "Danois" },
  { code: "heb", label: "Hébreu" },
  { code: "vie", label: "Vietnamien" },
  { code: "ind", label: "Indonésien" },
  { code: "may", label: "Malais" },
  { code: "ukr", label: "Ukrainien" },
  { code: "bul", label: "Bulgare" },
  { code: "hrv", label: "Croate" },
  { code: "srp", label: "Serbe" },
  { code: "cat", label: "Catalan" },
  { code: "tam", label: "Tamoul" },
  { code: "tel", label: "Télougou" },
  { code: "per", label: "Persan" },
] as const;

export const SUBTITLE_MODES = [
  { value: "none", label: "Désactivés" },
  { value: "always", label: "Toujours affichés" },
  { value: "forced", label: "Forcés uniquement" },
  { value: "signs", label: "Signs & Songs" },
] as const;

// ── Language alias groups ──
// ISO 639-1, ISO 639-2/B & /T, display names.
// Jellyfin uses inconsistent codes; this ensures robust matching.

const LANG_GROUPS: string[][] = [
  ["fr", "fre", "fra", "french", "français", "francais"],
  ["en", "eng", "english"],
  ["ja", "jp", "jpn", "jap", "japanese", "japonais"],
  ["de", "ger", "deu", "german", "allemand"],
  ["es", "spa", "spanish", "espagnol"],
  ["it", "ita", "italian", "italien"],
  ["pt", "por", "portuguese", "portugais"],
  ["ru", "rus", "russian", "russe"],
  ["ko", "kor", "korean", "coréen"],
  ["zh", "chi", "zho", "chinese", "chinois"],
  ["ar", "ara", "arabic", "arabe"],
  ["pl", "pol", "polish", "polonais"],
  ["nl", "dut", "nld", "dutch", "néerlandais"],
  ["cs", "cze", "ces", "czech", "tchèque"],
  ["hi", "hin", "hindi"],
  ["th", "tha", "thai"],
  ["sv", "swe", "swedish", "suédois"],
  ["no", "nor", "nob", "nno", "norwegian", "norvégien"],
  ["fi", "fin", "finnish", "finnois"],
  ["tr", "tur", "turkish", "turc"],
  ["hu", "hun", "hungarian", "hongrois"],
  ["ro", "ron", "rum", "romanian", "roumain"],
  ["el", "gre", "ell", "greek", "grec"],
  ["da", "dan", "danish", "danois"],
  ["he", "heb", "hebrew", "hébreu"],
  ["vi", "vie", "vietnamese", "vietnamien"],
  ["id", "ind", "indonesian", "indonésien"],
  ["ms", "may", "msa", "malay", "malais"],
  ["uk", "ukr", "ukrainian", "ukrainien"],
  ["bg", "bul", "bulgarian", "bulgare"],
  ["hr", "hrv", "croatian", "croate"],
  ["sr", "srp", "scc", "serbian", "serbe"],
  ["ca", "cat", "catalan"],
  ["ta", "tam", "tamil", "tamoul"],
  ["te", "tel", "telugu", "télougou"],
  ["fa", "per", "fas", "persian", "persan"],
  ["sk", "slo", "slk", "slovak", "slovaque"],
  ["sl", "slv", "slovenian", "slovène"],
  ["lt", "lit", "lithuanian", "lituanien"],
  ["lv", "lav", "latvian", "letton"],
  ["et", "est", "estonian", "estonien"],
  ["ml", "mal", "malayalam"],
  ["bn", "ben", "bengali"],
  ["ur", "urd", "urdu"],
  ["tl", "fil", "tagalog", "filipino"],
];

const ALIAS_MAP = new Map<string, Set<string>>();
for (const group of LANG_GROUPS) {
  const s = new Set(group);
  for (const code of group) ALIAS_MAP.set(code, s);
}

export function langMatches(trackLang: string | undefined, prefLang: string): boolean {
  if (!trackLang) return false;
  const tl = trackLang.toLowerCase();
  const pl = prefLang.toLowerCase();
  if (tl === pl) return true;
  const group = ALIAS_MAP.get(pl);
  return group?.has(tl) ?? false;
}

/** Split a variant-aware language code: "fre-vff" → ["fre", "vff"], "jpn" → ["jpn", null]. */
export function parseVariant(code: string): [string, string | null] {
  const idx = code.indexOf("-");
  if (idx < 0) return [code, null];
  return [code.substring(0, idx), code.substring(idx + 1)];
}

// ── Client-side track resolution ──

export function resolveMediaTracks(
  pref: LibraryPreference | null,
  audioTracks: AudioTrackInfo[],
  subtitleTracks: SubtitleTrackInfo[],
): TrackResolution {
  // No preference — use defaults
  if (!pref) {
    return {
      audioIndex: audioTracks.find((t) => t.isDefault)?.index ?? audioTracks[0]?.index ?? null,
      subtitleIndex: null,
    };
  }

  // Resolve audio: prefer matching language, fallback to default.
  // Supports variant codes like "fre-vff" or "fre-vfq" — splits into base lang + variant tag.
  let audioIndex = audioTracks.find((t) => t.isDefault)?.index ?? audioTracks[0]?.index ?? null;
  if (pref.audioLang) {
    const [baseLang, variant] = parseVariant(pref.audioLang);
    const langCandidates = audioTracks.filter((t) => langMatches(t.language, baseLang));
    if (variant && langCandidates.length > 0) {
      const variantMatch = langCandidates.find((t) =>
        t.title?.toLowerCase().includes(variant.toLowerCase()),
      );
      audioIndex = variantMatch?.index ?? langCandidates[0].index;
    } else if (langCandidates.length > 0) {
      audioIndex = langCandidates[0].index;
    }
  }

  // Resolve subtitle based on mode
  let subtitleIndex: number | null = null;
  if (pref.subtitleMode !== "none" && pref.subtitleLang) {
    const subs = subtitleTracks.filter((t) => langMatches(t.language, pref.subtitleLang!));
    const nonForced = subs.filter((t) => !t.isForced);
    const forced = subs.filter((t) => t.isForced);

    if (pref.subtitleMode === "forced") {
      if (forced.length > 0) subtitleIndex = forced[0].index;
    } else if (pref.subtitleMode === "signs") {
      const signs = subs.find((t) =>
        t.title?.toLowerCase().includes("sign") ||
        t.title?.toLowerCase().includes("songs"),
      );
      if (signs) subtitleIndex = signs.index;
      else if (forced.length > 0) subtitleIndex = forced[0].index;
    } else if (pref.subtitleMode === "always") {
      if (nonForced.length > 0) subtitleIndex = nonForced[0].index;
      else if (forced.length > 0) subtitleIndex = forced[0].index;
    }
  }

  return { audioIndex, subtitleIndex };
}
